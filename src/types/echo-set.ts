import type { BuffDef } from "./buff"

export interface EchoSetEffect {
  pieces: number
  description: string
}

export interface EchoSet {
  id: number
  name: string
  type: "two-five" | "three-only"
  effects: EchoSetEffect[]
  buffs: BuffDef[]
}
