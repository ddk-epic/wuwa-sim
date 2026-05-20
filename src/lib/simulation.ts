import type { DamageEntry, HealTarget, SkillType } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type {
  ActionEvent,
  BuffEvent,
  HitEvent,
  SimulationLogEntry,
  SustainEvent,
} from "#/types/simulation-log"
import type { TimelineEntry } from "#/types/timeline"
import { computeDamage } from "./compute-damage"
import { computeHealing } from "./compute-healing"
import { BuffEngine } from "./buff-engine"
import type { ResolvedHit } from "./buff-engine"
import { findStageByEntry, resolveStageExecution } from "./stage"
import type { ResolvedStage } from "./stage"

const CANCEL_CAPABLE = new Set<SkillType>([
  "Resonance Skill",
  "Resonance Liberation",
  "Intro Skill",
  "Outro Skill",
  "Echo Skill",
])

interface PendingTrailingHit {
  hit: DamageEntry
  hitIndex: number
  stageStartFrame: number
  entry: TimelineEntry
  resolved: ResolvedStage
  hitFrame: number
}

interface CharPendingState {
  hits: PendingTrailingHit[]
  swapActionRef: ActionEvent
}

export function runSimulation(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
  reactionDelay: number = 9,
  swapFrames: number = 6,
): SimulationLogEntry[] {
  const log: SimulationLogEntry[] = []
  const engine = new BuffEngine()
  engine.bootstrap({ slots, loadouts })
  let frame = 0
  const pending = new Map<number, CharPendingState>()

  for (const entry of entries) {
    let padFrames = 0
    const charState = pending.get(entry.characterId)
    if (charState && charState.hits.length > 0) {
      const charPending = charState.hits
      const hasCollision = charPending.some((p) => p.hitFrame >= frame)
      if (hasCollision) {
        const incomingResolved = findStageByEntry(entry, slots, loadouts)
        const skillType = incomingResolved?.skillType ?? "Basic Attack"
        if (CANCEL_CAPABLE.has(skillType)) {
          for (const p of charPending.filter((p) => p.hitFrame < frame)) {
            processHit(
              p.hit,
              p.hitIndex,
              p.stageStartFrame,
              p.entry,
              p.resolved,
              engine,
              log,
              slots,
            )
          }
          const droppedCount = charPending.filter(
            (p) => p.hitFrame >= frame,
          ).length
          if (droppedCount > 0) {
            charState.swapActionRef.droppedHitCount = droppedCount
          }
        } else {
          const lastHit = charPending[charPending.length - 1]
          const frameBeforePad = frame
          frame = lastHit.hitFrame
          padFrames = frame - frameBeforePad
          for (const p of charPending) {
            processHit(
              p.hit,
              p.hitIndex,
              p.stageStartFrame,
              p.entry,
              p.resolved,
              engine,
              log,
              slots,
            )
          }
        }
      } else {
        for (const p of charPending) {
          processHit(
            p.hit,
            p.hitIndex,
            p.stageStartFrame,
            p.entry,
            p.resolved,
            engine,
            log,
            slots,
          )
        }
      }
      pending.delete(entry.characterId)
    }

    const { nextFrame, trailingHits, swapActionRef } = processEntry(
      entry,
      frame,
      engine,
      log,
      slots,
      loadouts,
      reactionDelay,
      swapFrames,
      padFrames,
    )
    frame = nextFrame
    if (trailingHits.length > 0 && swapActionRef) {
      pending.set(entry.characterId, { hits: trailingHits, swapActionRef })
    }
  }

  // Drain any remaining pending trailing hits
  for (const { hits } of pending.values()) {
    for (const p of hits) {
      processHit(
        p.hit,
        p.hitIndex,
        p.stageStartFrame,
        p.entry,
        p.resolved,
        engine,
        log,
        slots,
      )
    }
  }

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
): {
  nextFrame: number
  trailingHits: PendingTrailingHit[]
  swapActionRef: ActionEvent | null
} {
  const resolved = findStageByEntry(entry, slots, loadouts)
  if (!resolved)
    return { nextFrame: stageStartFrame, trailingHits: [], swapActionRef: null }

  const { advance: stageDuration, hits } = resolveStageExecution(
    resolved.stage,
    entry.variantKind,
    reactionDelay,
    swapFrames,
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
    reactionDelay,
    padFrames,
  )
  log.push(actionEvent)

  const isSwap = entry.variantKind === "swap"
  const immediateHits = isSwap
    ? hits.filter((h) => h.actionFrame <= stageDuration)
    : hits
  const trailingHitData = isSwap
    ? hits.filter((h) => h.actionFrame > stageDuration)
    : []

  for (let i = 0; i < immediateHits.length; i++) {
    processHit(
      immediateHits[i],
      i,
      stageStartFrame,
      entry,
      resolved,
      engine,
      log,
      slots,
    )
  }

  const trailingHits: PendingTrailingHit[] = trailingHitData.map((h, idx) => ({
    hit: h,
    hitIndex: immediateHits.length + idx,
    stageStartFrame,
    entry,
    resolved,
    hitFrame: stageStartFrame + h.actionFrame,
  }))

  return {
    nextFrame: stageStartFrame + stageDuration,
    trailingHits,
    swapActionRef: trailingHits.length > 0 ? actionEvent : null,
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
  for (const synth of result.syntheticHits) {
    synth.sourceEntryId = entry.id
    log.push(synth)
  }
}

function buildActionEvent(
  entry: TimelineEntry,
  resolved: ResolvedStage,
  engine: BuffEngine,
  frame: number,
  reactionDelay: number = 0,
  padFrames: number = 0,
): ActionEvent {
  const actorState = engine.getResource(entry.characterId)
  const react = computeReactFrames(
    entry.variantKind,
    resolved.stage,
    reactionDelay,
  )
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
  if (react > 0 || padFrames > 0) {
    event.delayBreakdown = { react, pad: padFrames }
  }
  return event
}

function computeReactFrames(
  variantKind: ActionEvent["variantKind"],
  stage: { variants?: Partial<Record<string, unknown>> },
  reactionDelay: number,
): number {
  if (!variantKind) return 0
  if (variantKind === "swap") {
    return stage.variants?.swap !== undefined ? reactionDelay : 0
  }
  return stage.variants?.[variantKind] !== undefined ? reactionDelay : 0
}

function processHit(
  hit: DamageEntry,
  hitIndex: number,
  stageStartFrame: number,
  entry: TimelineEntry,
  resolved: ResolvedStage,
  engine: BuffEngine,
  log: SimulationLogEntry[],
  slots: Slots,
): void {
  const hitFrame = stageStartFrame + hit.actionFrame
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
  for (const synth of dispatch.syntheticHits) {
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
  for (const synth of dispatch.syntheticHits) {
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
