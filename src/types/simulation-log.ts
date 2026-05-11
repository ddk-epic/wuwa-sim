import type { StatTable } from "./stat-table"
import type { VariantKind } from "./character"

interface SimulationLogBase {
  characterId: number
  skillType: string
  skillName: string
  frame: number
  cumulativeEnergy: number
  cumulativeConcerto: number
}

export interface ActionEvent extends SimulationLogBase {
  kind: "action"
  variantKind?: VariantKind
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
  element: string
  dmgType: string
  scalingStat?: string
  statsSnapshot: StatTable
  activeBuffs: ActiveBuff[]
  /** True when the hit was injected by an `emitHit` effect rather than authored. */
  synthetic?: boolean
  /** When `synthetic` is true, the BuffDef.id that emitted the hit. */
  sourceBuffId?: string
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

export type SimulationLogEntry = ActionEvent | HitEvent | BuffEvent
