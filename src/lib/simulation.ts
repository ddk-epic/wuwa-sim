import type { DamageEntry, Footing, HealTarget } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type {
  ActionEvent,
  BuffEvent,
  HitEvent,
  SimulationLogEntry,
  SustainEvent,
} from "#/types/simulation-log"
import type { TimelineEntry } from "#/types/timeline"
import { computeDamage } from "./damage/compute-damage"
import { computeHealing } from "./damage/compute-healing"
import { BuffEngine } from "./engine/buff-engine"
import type { ResolvedHit } from "./engine/buff-engine"
import { findStageByEntry, resolveStageExecution } from "./stage"
import type { ResolvedStage } from "./stage"
import * as TrailingWindow from "./trailing-window"
import type { TrailingHit } from "./trailing-window"

export function runSimulation(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
  reactionDelay: number = 9,
  swapFrames: number = 6,
  variantFloor: number = 0,
  fallFrames: number = 21,
): SimulationLogEntry[] {
  const log: SimulationLogEntry[] = []
  const engine = new BuffEngine()
  engine.bootstrap({ slots, loadouts })
  let frame = 0
  let state = TrailingWindow.empty()

  for (const entry of entries) {
    const resolved = findStageByEntry(entry, slots, loadouts)
    const incomingSkillType = resolved?.skillType ?? "Basic Attack"
    const arrival = TrailingWindow.onEntryArrival(state, {
      characterId: entry.characterId,
      skillType: incomingSkillType,
      frame,
    })
    state = arrival.stateAfter
    for (const h of arrival.fireBeforeEntry) processHit(h, engine, log, slots)
    if (arrival.pendingFootingToFire) {
      engine.footing.snapshotTrailing(
        entry.characterId,
        arrival.pendingFootingToFire.exitFooting,
      )
    }
    frame += arrival.padFrames
    const animFrames = resolved?.stage.animationFrames ?? 0
    if (animFrames > 0) engine.advanceOffFieldClocks(animFrames)
    const swapBack = engine.computeSwapBack(entry.characterId, frame)

    if (!resolved) continue

    const { allHits, stageDuration, stageStartFrame, nextFrame } = processEntry(
      entry,
      frame,
      resolved,
      engine,
      log,
      reactionDelay,
      swapFrames,
      arrival.padFrames,
      variantFloor,
      fallFrames,
      swapBack,
    )
    engine.footing.applyStageFooting(
      entry.characterId,
      resolved.stage.footing,
      stageDuration,
    )
    const sched = TrailingWindow.scheduleStage(state, {
      entry,
      resolved,
      stageStartFrame,
      hits: allHits,
      variantKind: entry.variantKind,
      stageDuration,
    })
    state = sched.stateAfter
    for (const h of sched.immediate) processHit(h, engine, log, slots)
    frame = nextFrame
  }

  for (const charId of state.keys())
    engine.footing.clearTrailingSnapshot(charId)
  for (const h of TrailingWindow.drainAll(state))
    processHit(h, engine, log, slots)

  return log
}

function processEntry(
  entry: TimelineEntry,
  stageStartFrame: number,
  resolved: ResolvedStage,
  engine: BuffEngine,
  log: SimulationLogEntry[],
  reactionDelay: number,
  swapFrames: number,
  padFrames: number = 0,
  variantFloor: number = 0,
  fallFrames: number = 21,
  swapBack: number = 0,
): {
  allHits: DamageEntry[]
  stageDuration: number
  stageStartFrame: number
  nextFrame: number
} {
  const {
    advance: stageDuration,
    hits: allHits,
    react,
    floor,
  } = resolveStageExecution(
    resolved.stage,
    entry.variantKind,
    reactionDelay,
    swapFrames,
    variantFloor,
  )

  const effectiveFooting = engine.footing.promoteOnSwapIn(entry.characterId)
  const fall = computeFall(effectiveFooting, resolved.stage.footing, fallFrames)

  const effectiveStart = stageStartFrame + fall + swapBack

  pushBuffEvents(log, engine.tickToFrame(effectiveStart).lifecycleEvents)

  if (resolved.skillType !== "Movement") {
    fireSkillCast(entry, resolved, engine, log, effectiveStart)
  }

  const actionEvent = buildActionEvent(
    entry,
    resolved,
    engine,
    effectiveStart,
    react,
    floor,
    padFrames,
    fall,
    swapBack,
  )
  log.push(actionEvent)

  return {
    allHits,
    stageDuration,
    stageStartFrame: effectiveStart,
    nextFrame: effectiveStart + stageDuration,
  }
}

function fireSkillCast(
  entry: TimelineEntry,
  resolved: ResolvedStage,
  engine: BuffEngine,
  log: SimulationLogEntry[],
  frame: number,
): void {
  const result = engine.onEvent({
    kind: "skillCast",
    characterId: entry.characterId,
    skillCategory: resolved.skillCategory,
    stageId: resolved.stageId,
    frame,
    concerto: resolved.concerto,
    resonanceCost: resolved.resonanceCost,
  })
  pushBuffEvents(log, result.lifecycleEvents)
  for (const synth of result.syntheticEvents) {
    synth.sourceEntryId = entry.id
    log.push(synth)
  }
}

function buildActionEvent(
  entry: TimelineEntry,
  resolved: ResolvedStage,
  engine: BuffEngine,
  frame: number,
  react: number = 0,
  floor: number = 0,
  padFrames: number = 0,
  fall: number = 0,
  swapBack: number = 0,
): ActionEvent {
  const actorState = engine.getResource(entry.characterId)
  const event: ActionEvent = {
    kind: "action",
    characterId: entry.characterId,
    skillType: resolved.damage[0]?.type ?? resolved.skillType,
    skillName: resolved.skillName,
    frame,
    cumulativeEnergy: actorState.energy,
    cumulativeConcerto: actorState.concerto,
    variantKind: entry.variantKind,
    sourceEntryId: entry.id,
  }
  if (react > 0 || floor > 0 || padFrames > 0 || fall > 0 || swapBack > 0) {
    event.delayBreakdown = { react, floor, pad: padFrames, fall, swapBack }
  }
  return event
}

function computeFall(
  currentFooting: "ground" | "air",
  stageFooting: Footing | undefined,
  fallFrames: number,
): number {
  if (currentFooting !== "air") return 0
  if (stageFooting !== "ground") return 0
  return fallFrames
}

function processHit(
  bundle: TrailingHit,
  engine: BuffEngine,
  log: SimulationLogEntry[],
  slots: Slots,
): void {
  const { hit, hitIndex, entry, resolved, hitFrame } = bundle
  const hitResolved = engine.resolveHit(entry.characterId, hitFrame)
  pushBuffEvents(log, hitResolved.lifecycleEvents)

  if (hit.dmgType === "Heal") {
    processHeal(
      hit,
      hitIndex,
      hitFrame,
      entry,
      resolved,
      hitResolved,
      engine,
      log,
      slots,
    )
  } else {
    processDamageHit(
      hit,
      hitIndex,
      hitFrame,
      entry,
      resolved,
      hitResolved,
      engine,
      log,
    )
  }
}

function processHeal(
  hit: DamageEntry,
  hitIndex: number,
  hitFrame: number,
  entry: TimelineEntry,
  resolved: ResolvedStage,
  hitResolved: ResolvedHit,
  engine: BuffEngine,
  log: SimulationLogEntry[],
  slots: Slots,
): void {
  const amount = computeHealing(
    { multiplier: hit.value, scalingStat: hit.scalingStat, flat: hit.flat },
    hitResolved.stats,
  )
  const dispatch = engine.recordHeal({
    kind: "healLanded",
    characterId: entry.characterId,
    skillCategory: resolved.skillCategory,
    frame: hitFrame,
    stageId: `${resolved.stageId}.${hitIndex + 1}`,
  })
  const sustainEvent: SustainEvent = {
    kind: "sustain",
    sub: "heal",
    characterId: entry.characterId,
    skillType: hit.type,
    skillName: `${resolved.skillName} [heal ${hitIndex + 1}]`,
    frame: hitFrame,
    cumulativeEnergy: dispatch.postState.energy,
    cumulativeConcerto: dispatch.postState.concerto,
    amount,
    targets: resolveHealTargets(hit.target ?? "self", entry.characterId, slots),
    scalingStat: hit.scalingStat,
    multiplier: hit.value,
    flat: hit.flat,
    statsSnapshot: { ...hitResolved.stats },
    activeBuffs: hitResolved.activeBuffs,
    passiveBuffs: hitResolved.passiveBuffs,
  }
  log.push(sustainEvent)
  pushBuffEvents(log, dispatch.lifecycleEvents)
  for (const synth of dispatch.syntheticEvents) {
    synth.sourceEntryId = entry.id
    log.push(synth)
  }
}

function processDamageHit(
  hit: DamageEntry,
  hitIndex: number,
  hitFrame: number,
  entry: TimelineEntry,
  resolved: ResolvedStage,
  hitResolved: ResolvedHit,
  engine: BuffEngine,
  log: SimulationLogEntry[],
): void {
  const dmg = computeDamage(
    {
      multiplier: hit.value,
      element: resolved.element,
      skillType: hit.type,
      dmgType: hit.dmgType,
      scalingStat: hit.scalingStat,
    },
    hitResolved.stats,
  )
  const dispatch = engine.recordHit({
    kind: "hitLanded",
    characterId: entry.characterId,
    skillCategory: resolved.skillCategory,
    dmgType: hit.dmgType,
    frame: hitFrame,
    stageId: `${resolved.stageId}.${hitIndex + 1}`,
    energy: hit.energy,
    concerto: hit.concerto,
    forte: hit.forte,
  })
  const hitEvent: HitEvent = {
    kind: "hit",
    characterId: entry.characterId,
    skillType: hit.type,
    skillName: `${resolved.skillName} [hit ${hitIndex + 1}]`,
    frame: hitFrame,
    cumulativeEnergy: dispatch.postState.energy,
    cumulativeConcerto: dispatch.postState.concerto,
    damage: dmg,
    element: resolved.element,
    dmgType: hit.dmgType,
    scalingStat: hit.scalingStat,
    multiplier: hit.value,
    statsSnapshot: { ...hitResolved.stats },
    activeBuffs: hitResolved.activeBuffs,
    passiveBuffs: hitResolved.passiveBuffs,
    sourceEntryId: entry.id,
  }
  log.push(hitEvent)
  pushBuffEvents(log, dispatch.lifecycleEvents)
  for (const synth of dispatch.syntheticEvents) {
    synth.sourceEntryId = entry.id
    log.push(synth)
  }
}

function pushBuffEvents(log: SimulationLogEntry[], events: BuffEvent[]): void {
  for (const e of events) log.push(e)
}

function resolveHealTargets(
  target: HealTarget,
  healerId: number,
  slots: Slots,
): number[] {
  switch (target) {
    case "self":
    case "source":
      return [healerId]
    case "currentOnField":
      return [healerId]
    case "team":
      return slots.filter((id) => id !== null)
    case "nextOnField":
      return []
  }
}
