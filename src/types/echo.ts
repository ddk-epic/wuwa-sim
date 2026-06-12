import type { Element } from "#/data/elements"
import type {
  DamageEntry,
  Footing,
  StageVariant,
  VariantKind,
} from "./character.js"
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
  element: Element
  skill: EchoSkill
  sets: string[]
  buffs: BuffDef[]
}

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

export interface EnrichedEchoStage {
  /** Override for `deriveKey(name)` collisions. */
  key?: string
  name: string
  newName: string
  actionTime: number
  hidden?: boolean
  variants?: Partial<Record<VariantKind, StageVariant>>
  footing?: Footing
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
