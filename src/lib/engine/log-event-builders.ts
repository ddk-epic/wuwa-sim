import type { Element } from "#/data/elements"
import type { SkillType } from "#/types/character"
import type { ActiveBuff, HitEvent, SustainEvent } from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import { cloneStats } from "./stat-table-builder"

/**
 * The damage/stat/resource block shared by authored and synthetic hits — every
 * field of a {@link HitEvent} except its origin tail. `statsSnapshot` is the raw
 * resolved table; the builder deep-clones it.
 */
export interface HitEventCore {
  characterId: number
  frame: number
  skillType: SkillType
  element: Element
  dmgType: string
  scalingStat?: string
  multiplier: number
  damage: number
  cumulativeEnergy: number
  cumulativeConcerto: number
  cumulativeForte: number
  statsSnapshot: StatTable
  activeBuffs: ActiveBuff[]
  passiveBuffs: ActiveBuff[]
}

/** The shared block for a {@link SustainEvent} (heal) — every field but the origin tail. */
export interface SustainEventCore {
  characterId: number
  frame: number
  skillType: SkillType
  scalingStat?: string
  multiplier: number
  amount: number
  flat?: number
  targets: number[]
  cumulativeEnergy: number
  cumulativeConcerto: number
  cumulativeForte: number
  statsSnapshot: StatTable
  activeBuffs: ActiveBuff[]
  passiveBuffs: ActiveBuff[]
}

/**
 * The discriminated origin tail that drives log labeling/grouping. Authored hits
 * carry their timeline-entry id; synthetic/coord hits carry the emitting BuffDef
 * id (the `sourceEntryId` is stamped later, at the resolution site).
 */
export type EventAttribution =
  | { kind: "authored"; skillName: string; sourceEntryId: string }
  | { kind: "synthetic"; skillName: string; sourceBuffId: string; coord?: true }

function applyAttribution(
  event: HitEvent | SustainEvent,
  attribution: EventAttribution,
): void {
  if (attribution.kind === "authored") {
    event.sourceEntryId = attribution.sourceEntryId
    return
  }
  event.synthetic = true
  event.sourceBuffId = attribution.sourceBuffId
  if (attribution.coord) event.coord = true
}

/** Sole construction site for a {@link HitEvent}, from a shared core + origin tail. */
export function buildHitEvent(
  core: HitEventCore,
  attribution: EventAttribution,
): HitEvent {
  const event: HitEvent = {
    kind: "hit",
    characterId: core.characterId,
    skillType: core.skillType,
    skillName: attribution.skillName,
    frame: core.frame,
    cumulativeEnergy: core.cumulativeEnergy,
    cumulativeConcerto: core.cumulativeConcerto,
    cumulativeForte: core.cumulativeForte,
    damage: core.damage,
    element: core.element,
    dmgType: core.dmgType,
    scalingStat: core.scalingStat,
    multiplier: core.multiplier,
    statsSnapshot: cloneStats(core.statsSnapshot),
    activeBuffs: core.activeBuffs,
    passiveBuffs: core.passiveBuffs,
  }
  applyAttribution(event, attribution)
  return event
}

/** Sole construction site for a {@link SustainEvent} (heal), from a shared core + origin tail. */
export function buildSustainEvent(
  core: SustainEventCore,
  attribution: EventAttribution,
): SustainEvent {
  const event: SustainEvent = {
    kind: "sustain",
    sub: "heal",
    characterId: core.characterId,
    skillType: core.skillType,
    skillName: attribution.skillName,
    frame: core.frame,
    cumulativeEnergy: core.cumulativeEnergy,
    cumulativeConcerto: core.cumulativeConcerto,
    cumulativeForte: core.cumulativeForte,
    amount: core.amount,
    targets: core.targets,
    scalingStat: core.scalingStat,
    multiplier: core.multiplier,
    flat: core.flat,
    statsSnapshot: cloneStats(core.statsSnapshot),
    activeBuffs: core.activeBuffs,
    passiveBuffs: core.passiveBuffs,
  }
  applyAttribution(event, attribution)
  return event
}
