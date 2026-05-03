import type { StatTable } from "./stat-table"

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
}

export interface HitEvent extends SimulationLogBase {
  kind: "hit"
  damage: number
  statsSnapshot: StatTable
  activeBuffIds: string[]
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
