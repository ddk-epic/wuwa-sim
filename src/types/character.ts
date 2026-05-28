import type { Element } from "#/data/elements"
import type { BuffDef } from "./buff"

/**
 * UI skill-tree section a skill belongs to. Populated from the game API on
 * `Skill.type`. No engine presence — used only for sidebar filtering.
 */
export type SkillGrouping =
  | "Normal Attack"
  | "Forte Circuit"
  | "Inherent Skill"
  | "Resonance Skill"
  | "Resonance Liberation"
  | "Intro Skill"
  | "Outro Skill"
  | "Tune Break"
  | "Echo Skill"
  | "Movement"

/**
 * Player input/action that triggered a stage. Mandatory per-stage tag.
 * Encoded in the stageId lineage and used for trigger matching.
 */
export type SkillCategory =
  | "Basic Attack"
  | "Heavy Attack"
  | "Resonance Skill"
  | "Resonance Liberation"
  | "Intro Skill"
  | "Outro Skill"
  | "Tune Break"
  | "Echo Skill"
  | "Movement"

/**
 * Damage-calc type, derived from `damage[0].type`. Used for `skillTypeBonus`,
 * `skillTypeDeepen`, `shred` lookups in the damage formula.
 *
 * NOTE: `"Forte Circuit"` remains here pending trigger migration (#272) and the
 * Sanhua Avalanche rework (#274). Per ADR-0024 it is a `SkillGrouping`-only
 * member and the long-term plan is to remove it from `SkillType`.
 */
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
  /** Player input/action that produces this stage. Encoded in the stageId lineage. */
  category: SkillCategory
  value: string
  staCost?: number
  cooldown?: number
  concerto?: number
  damage?: DamageEntry[]
  /** Wall-clock frames (at 60fps) for a cutscene animation. Engine clock does not advance. */
  animationFrames?: number
}

export type HealTarget =
  | "self"
  | "source"
  | "team"
  | "currentOnField"
  | "nextOnField"

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
  /** Recipient scope for heal entries (dmgType: "Heal"). Defaults to "self" when omitted. */
  target?: HealTarget
  /** Lands at its authored actionFrame regardless of cancel/instantCancel cutoff. */
  independent?: boolean
  /** Per-hit forte resource gain for the actor. Scaled by forteRechargePct. */
  forte?: number
}

export interface Skill {
  id: number
  name: string
  type: SkillGrouping
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
  element: Element
  weaponType: string
  rarity: string
  stats: CharacterStats
  skills: Skill[]
  skillTreeBonuses: string[]
  buffs: BuffDef[]
  recommendedSkillDmgPriority?: SkillType
  primaryScalingStat?: "atk" | "hp" | "def"
}

export type VariantKind = "cancel" | "instantCancel" | "swap"

export interface StageVariant {
  actionTime: number
}

export type MovementKind = "Dodge" | "Jump"

export type Footing = "ground" | "air" | { launch: number } | { land: number }

type EnrichedSkillAttributeBase = Omit<SkillAttribute, "staCost"> & {
  id?: string
  actionTime: number
  hidden?: boolean
  newName?: string
  variants?: Partial<Record<VariantKind, StageVariant>>
  footing?: Footing
}

export type EnrichedSkillAttribute =
  | (EnrichedSkillAttributeBase & {
      requiresStageId: string
      comboAllows?: readonly MovementKind[]
    })
  | (EnrichedSkillAttributeBase & {
      requiresStageId?: never
    })

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
  forteCap?: number
  template: CharacterTemplate
}
