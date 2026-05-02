import type { DamageEntry } from "./character.js"
import type { BuffDef } from "./buff"

export type { DamageEntry }

export interface EchoSkill {
  cooldown: number
  description: string
  hits: DamageEntry[]
}

export interface Echo {
  id: number
  name: string
  cost: number
  element: string
  skill: EchoSkill
  set: string
  buffs: BuffDef[]
}

export interface EchoSetEffect {
  pieces: number
  description: string
}

export interface EchoSet {
  id: number
  name: string
  effects: EchoSetEffect[]
  buffs: BuffDef[]
}

export interface EnrichedEchoStage {
  name: string
  newName: string
  actionTime: number
  hidden?: boolean
  damage: DamageEntry[]
}

export interface EnrichedEchoSkill {
  cooldown: number
  description: string
  stages: EnrichedEchoStage[]
}

export interface EnrichedEcho extends Omit<Echo, "skill"> {
  skill: EnrichedEchoSkill
}
