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
}

export type SimulationLogEntry = ActionEvent | HitEvent
