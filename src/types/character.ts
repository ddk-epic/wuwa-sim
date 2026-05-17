import type { BuffDef } from "./buff"

export type SkillType =
  | "Basic Attack"
  | "Heavy Attack"
  | "Resonance Skill"
  | "Resonance Liberation"
  | "Forte Circuit"
  | "Intro Skill"
  | "Outro Skill"
  | "Echo Skill"
  | "Movement"

/** UI grouping labels for skills — not engine types. */
export type SkillCategory =
  | SkillType
  | "Normal Attack"
  | "Inherent Skill"
  | "Tune Break"

export interface StatGroup {
  hp: number
  atk: number
  def: number
}

export interface CharacterStats {
  base: StatGroup
  max: StatGroup
}

export interface SkillAttribute {
  name: string
  value: string
  staCost?: number
  cooldown?: number
  concerto?: number
  damage?: DamageEntry[]
}

export interface DamageEntry {
  type: SkillType
  dmgType: string
  scalingStat: string
  actionFrame: number
  flat?: number
  value: number
  energy: number
  concerto: number
  toughness: number
  weakness: number
}

export interface Skill {
  id: number
  name: string
  type: SkillCategory
  cooldown?: number
  duration?: number
  concerto?: number
  resonanceCost?: number
  stages: SkillAttribute[]
  damage: DamageEntry[]
}

export interface Character {
  id: number
  name: string
  element: string
  weaponType: string
  rarity: string
  stats: CharacterStats
  skills: Skill[]
  skillTreeBonuses: string[]
  buffs: BuffDef[]
  recommendedSkillDmgPriority?: SkillType
  primaryScalingStat?: "atk" | "hp" | "def"
}

export type VariantKind = "cancel" | "instantCancel"

export interface StageVariant {
  actionTime: number
}

export type EnrichedSkillAttribute = Omit<SkillAttribute, "staCost"> & {
  id?: string
  actionTime: number
  hidden?: boolean
  newName?: string
  requiresStageId?: string
  variants?: Partial<Record<VariantKind, StageVariant>>
}

export interface EnrichedSkill extends Omit<Skill, "stages"> {
  stages: EnrichedSkillAttribute[]
  animationLock?: number
  hidden?: boolean
}

export interface StageMetadata {
  name: string
  actionTime?: number
  hidden?: boolean
}

export interface SkillMetadata {
  name: string
  hidden?: boolean
  stages: StageMetadata[]
}

export interface CharacterTemplate {
  weapon: string
  echo: string
  echoSet: string
}

export interface EnrichedCharacter extends Omit<Character, "skills"> {
  skills: EnrichedSkill[]
  template: CharacterTemplate
}
