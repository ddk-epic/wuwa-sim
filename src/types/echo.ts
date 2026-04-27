import type { DamageEntry } from './character.js'

export type { DamageEntry }

export interface EchoSkill {
  cooldown: number
  description: string
  params: number[]
  damage: DamageEntry[]
}

export interface Echo {
  id: number
  name: string
  cost: number
  element: string
  skill: EchoSkill
  set: string
}
