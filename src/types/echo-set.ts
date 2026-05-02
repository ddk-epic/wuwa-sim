import type { BuffDef } from "./buff"

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
