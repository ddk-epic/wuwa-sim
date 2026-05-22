import type { DamageEntry, HealTarget } from "#/types/character"
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
import { findStageByEntry, resolveStageExecution } from "./stage/stage"
import type { ResolvedStage } from "./stage/stage"
import * as TrailingWindow from "./stage/trailing-window"
import type { TrailingHit } from "./stage/trailing-window"

export function runSimulation(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
  reactionDelay: number = 9,
  swapFrames: number = 6,
  variantFloor: number = 0,
): SimulationLogEntry[] {
  const log: SimulationLogEntry[] = []
  const engine = new BuffEngine()
  engine.bootstrap({ slots, loadouts })
  let frame = 0
  let state = TrailingWindow.empty()

  for (const entry of entries) {
    const incomingSkillType =
      findStageByEntry(entry, slots, loadouts)?.skillType ?? "Basic Attack"
    const arrival = TrailingWindow.onEntryArrival(state, {
      characterId: entry.characterId,
      skillType: incomingSkillType,
      frame,
    })
    state = arrival.stateAfter
    for (const h of arrival.fireBeforeEntry) processHit(h, engine, log, slots)
    frame += arrival.padFrames

    const { resolved, allHits, stageDuration, nextFrame } = processEntry(
      entry,
      frame,
      engine,
      log,
      slots,
      loadouts,
      reactionDelay,
      swapFrames,
      arrival.padFrames,
      variantFloor,
    )
    if (resolved) {
      const sched = TrailingWindow.scheduleStage(state, {
        entry,
        resolved,
        stageStartFrame: frame,
        hits: allHits,
        variantKind: entry.variantKind,
        stageDuration,
      })
      state = sched.stateAfter
      for (const h of sched.immediate) processHit(h, engine, log, slots)
    }
    frame = nextFrame
  }

  for (const h of TrailingWindow.drainAll(state))
    processHit(h, engine, log, slots)

  return log
}

function processEntry(
  entry: TimelineEntry,
  stageStartFrame: number,
  engine: BuffEngine,
  log: SimulationLogEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
  reactionDelay: number,
  swapFrames: number,
  padFrames: number = 0,
  variantFloor: number = 0,
): {
  resolved: ResolvedStage | null
  allHits: DamageEntry[]
  stageDuration: number
  nextFrame: number
} {
  const resolved = findStageByEntry(entry, slots, loadouts)
  if (!resolved)
    return {
      resolved: null,
      allHits: [],
      stageDuration: 0,
      nextFrame: stageStartFrame,
    }

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

  pushBuffEvents(log, engine.tickToFrame(stageStartFrame).lifecycleEvents)

  if (resolved.skillType !== "Movement") {
    fireSkillCast(entry, resolved, engine, log, stageStartFrame)
  }

  const actionEvent = buildActionEvent(
    entry,
    resolved,
    engine,
    stageStartFrame,
    react,
    floor,
    padFrames,
  )
  log.push(actionEvent)

  return {
    resolved,
    allHits,
    stageDuration,
    nextFrame: stageStartFrame + stageDuration,
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
    skillType: resolved.skillType,
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
): ActionEvent {
  const actorState = engine.getResource(entry.characterId)
  const event: ActionEvent = {
    kind: "action",
    characterId: entry.characterId,
    skillType: resolved.skillType,
    skillName: resolved.skillName,
    frame,
    cumulativeEnergy: actorState.energy,
    cumulativeConcerto: actorState.concerto,
    variantKind: entry.variantKind,
    sourceEntryId: entry.id,
  }
  if (react > 0 || floor > 0 || padFrames > 0) {
    event.delayBreakdown = { react, floor, pad: padFrames }
  }
  return event
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
    skillType: hit.type,
    frame: hitFrame,
    stageId: resolved.stageId,
    hitIndex: hitIndex + 1,
  })
  const sustainEvent: SustainEvent = {
    kind: "sustain",
    sub: "heal",
    characterId: entry.characterId,
    skillType: resolved.skillType,
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
      skillType: resolved.skillType,
      dmgType: hit.dmgType,
      scalingStat: hit.scalingStat,
    },
    hitResolved.stats,
  )
  const dispatch = engine.recordHit({
    kind: "hitLanded",
    characterId: entry.characterId,
    skillType: hit.type,
    dmgType: hit.dmgType,
    frame: hitFrame,
    stageId: resolved.stageId,
    hitIndex: hitIndex + 1,
    energy: hit.energy,
    concerto: hit.concerto,
  })
  const hitEvent: HitEvent = {
    kind: "hit",
    characterId: entry.characterId,
    skillType: resolved.skillType,
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
