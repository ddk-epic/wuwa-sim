import type { Element } from "#/data/elements"
import type { StatTable } from "./stat-table"
import type { SkillType, VariantKind } from "./character"

interface SimulationLogBase {
  characterId: number
  skillType: SkillType
  skillName: string
  frame: number
  cumulativeEnergy: number
  cumulativeConcerto: number
}

/**
 * Padding Delay breakdown. `react`/`floor` are mutually exclusive (see
 * stage.ts); `pad`/`fall`/`swapBack` are additive.
 */
export interface DelayBreakdown {
  react: number
  floor: number
  pad: number
  fall: number
  swapBack: number
}

export interface ActionEvent extends SimulationLogBase {
  kind: "action"
  variantKind?: VariantKind
  delayBreakdown?: DelayBreakdown
  sourceEntryId?: string
}

export interface ActiveBuff {
  id: string
  name: string
  stacks: number
  sourceCharacterId?: number
}

export interface HitEvent extends SimulationLogBase {
  kind: "hit"
  damage: number
  element: Element
  dmgType: string
  scalingStat?: string
  multiplier: number
  statsSnapshot: StatTable
  activeBuffs: ActiveBuff[]
  passiveBuffs: ActiveBuff[]
  /** True when the hit was injected by an `emitHit` effect rather than authored. */
  synthetic?: boolean
  /** When `synthetic` is true, the BuffDef.id that emitted the hit. */
  sourceBuffId?: string
  /** The TimelineEntry.id whose stage produced this hit (authored or synthetic). */
  sourceEntryId?: string
  /** True when emitted by a `coordHit` effect (coordinated attack). */
  coord?: true
}

export interface SustainEvent extends SimulationLogBase {
  kind: "sustain"
  sub: "heal" | "shield"
  amount: number
  targets: number[]
  scalingStat?: string
  multiplier: number
  flat?: number
  statsSnapshot: StatTable
  activeBuffs: ActiveBuff[]
  passiveBuffs: ActiveBuff[]
  synthetic?: boolean
  sourceBuffId?: string
  sourceEntryId?: string
  coord?: true
}

export interface BuffEvent {
  kind: "buffApplied" | "buffRefreshed" | "buffExpired" | "buffConsumed"
  buffId: string
  buffName: string
  sourceCharacterId: number
  targetCharacterId: number
  frame: number
  stacks: number
}

export type SimulationLogEntry =
  | ActionEvent
  | HitEvent
  | SustainEvent
  | BuffEvent

export type LogVariant = "table" | "timeline"
