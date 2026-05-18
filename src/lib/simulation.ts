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
import { computeDamage } from "./compute-damage"
import { computeHealing } from "./compute-healing"
import { BuffEngine, type ResolvedHit } from "./buff-engine"
import {
  findStageByEntry,
  resolveStageExecution,
  type ResolvedStage,
} from "./stage"

export function runSimulation(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
  reactionDelay: number = 9,
): SimulationLogEntry[] {
  const log: SimulationLogEntry[] = []
  const engine = new BuffEngine()
  engine.bootstrap({ slots, loadouts })
  let frame = 0
  for (const entry of entries) {
    frame = processEntry(
      entry,
      frame,
      engine,
      log,
      slots,
      loadouts,
      reactionDelay,
    )
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
): number {
  const resolved = findStageByEntry(entry, slots, loadouts)
  if (!resolved) return stageStartFrame

  const { duration: stageDuration, damage } = resolveStageExecution(
    resolved.stage,
    entry.variantKind,
    reactionDelay,
  )

  pushBuffEvents(log, engine.tickToFrame(stageStartFrame).lifecycleEvents)

  if (resolved.skillType !== "Movement") {
    fireSkillCast(entry, resolved, engine, log, stageStartFrame)
  }

  log.push(buildActionEvent(entry, resolved, engine, stageStartFrame))

  for (let i = 0; i < damage.length; i++) {
    processHit(
      damage[i],
      i,
      stageStartFrame,
      entry,
      resolved,
      engine,
      log,
      slots,
    )
  }

  return stageStartFrame + stageDuration
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
  for (const synth of result.syntheticHits) log.push(synth)
}

function buildActionEvent(
  entry: TimelineEntry,
  resolved: ResolvedStage,
  engine: BuffEngine,
  frame: number,
): ActionEvent {
  const actorState = engine.getResource(entry.characterId)
  return {
    kind: "action",
    characterId: entry.characterId,
    skillType: resolved.skillType,
    skillName: resolved.skillName,
    frame,
    cumulativeEnergy: actorState.energy,
    cumulativeConcerto: actorState.concerto,
    variantKind: entry.variantKind,
  }
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
  for (const synth of dispatch.syntheticHits) log.push(synth)
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
  }
  log.push(hitEvent)
  pushBuffEvents(log, dispatch.lifecycleEvents)
  for (const synth of dispatch.syntheticHits) log.push(synth)
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
