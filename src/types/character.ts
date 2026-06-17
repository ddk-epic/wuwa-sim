import type { Element } from "#/data/elements"
import type { HitLabel } from "#/data/hit-labels"
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
 * `skillTypeAmp`, `shred` lookups in the damage formula. Independent of the
 * trigger-matching `SkillCategory` axis — the two are orthogonal.
 *
 * `"Forte Circuit"` is **not** a `SkillType` — it is a `SkillGrouping` only.
 */
export type SkillType =
  | "Basic Attack"
  | "Heavy Attack"
  | "Resonance Skill"
  | "Resonance Liberation"
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
  /** "Counts-as" labels — a hit may bear several (e.g. a plunge considered Aero Erosion DMG). */
  labels?: HitLabel[]
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

/**
 * Buff source names lifted verbatim from the API for the raw extraction stage:
 * Inherent Skill names and Resonance Chain node names. These are scaffolds the
 * author turns into engine `BuffDef`s by hand in the enriched `.ts` file.
 */
export interface CharacterBuffNames {
  inherent: string[]
  resonanceChain: string[]
}

export type SkillTreeStat =
  | "ATK"
  | "HP"
  | "DEF"
  | "Crit. Rate"
  | "Crit. DMG"
  | "Healing Bonus"
  | `${Element} DMG Bonus`

export interface Character {
  id: number
  name: string
  element: Element
  weaponType: string
  rarity: string
  stats: CharacterStats
  skills: Skill[]
  skillTreeBonuses: SkillTreeStat[]
  buffs: CharacterBuffNames
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
  /** Override for `deriveKey(name)` collisions. */
  key?: string
  actionTime: number
  hidden?: boolean
  newName?: string
  variants?: Partial<Record<VariantKind, StageVariant>>
  footing?: Footing
}

export type EnrichedSkillAttribute =
  | (EnrichedSkillAttributeBase & {
      requiresPriorStage: string
      // Frames. Absent ⇒ prerequisite must immediately precede; present ⇒
      // prerequisite need only have cast earlier on the same character.
      minDelay?: number
    })
  | (EnrichedSkillAttributeBase & {
      requiresPriorStage?: never
    })

export interface EnrichedSkill extends Omit<Skill, "stages"> {
  key?: string
  stages: EnrichedSkillAttribute[]
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

export interface EnrichedCharacter extends Omit<Character, "skills" | "buffs"> {
  /** Full-bar energy value, equal to the Resonance Liberation cost. */
  maxEnergy: number
  skills: EnrichedSkill[]
  buffs: BuffDef[]
  forteCap?: number
  template: CharacterTemplate
}
