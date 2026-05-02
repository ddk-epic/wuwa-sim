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
}

export interface BuffEvent {
  kind: "buffApplied" | "buffRefreshed" | "buffExpired"
  buffId: string
  buffName: string
  sourceCharacterId: number
  targetCharacterId: number
  frame: number
  stacks: number
}

export type SimulationLogEntry = ActionEvent | HitEvent | BuffEvent
