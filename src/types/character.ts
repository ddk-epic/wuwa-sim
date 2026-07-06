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

/** The skill types that have a DMG Bonus echo substat. */
export type SubstatSkillType = Extract<
  SkillType,
  "Basic Attack" | "Heavy Attack" | "Resonance Skill" | "Resonance Liberation"
>

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
  /** Forte applied on cast (skillCast), before any hit lands. Capped by forteCap, floored at 0. */
  forte?: number
  damage?: DamageEntry[]
  /** Minimum Resonance Chain sequence for this stage; below it, the stage is hidden and validated. */
  requiresSequence?: number
  /** Concerto Energy required for this cast to be available; below it, an advisory diagnostic fires but the cast still resolves. */
  requiresConcerto?: number
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
  /** Deferred Emits this hit pushes onto the actor's Emit Pool. Not FR-scaled. */
  spawn?: number
  /** "Counts-as" labels — a hit may bear several (e.g. a plunge considered Aero Erosion DMG). */
  labels?: HitLabel[]
}

/**
 * A character's Emit Pool: a capacity-bounded FIFO of Deferred Emits. A hit's
 * `spawn` pushes members; each matures `maturation` frames later into a
 * Synthetic Hit carrying `emit` (the same authoring shape as `emitHit`).
 */
export interface EmitPoolConfig {
  /** Display label each converted emission carries in the log. */
  name: string
  /** Omit = uncapped. */
  cap?: number
  /** Frames from spawn to auto-conversion. */
  maturation: number
  /** Payload every member emits on conversion; its `actionFrame` is travel time. */
  emit: DamageEntry
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
  skillBonusPriority?: SubstatSkillType
}

export type VariantKind = "cancel" | "instantCancel" | "swap"

export interface StageVariant {
  actionTime: number
}

export type MovementKind = "Dodge" | "Jump"

export type Footing =
  | "ground"
  | "air"
  | "either"
  | { entry: "ground" | "air" | "any"; exit: "ground" | "air"; commit: number }

type EnrichedSkillAttributeBase = Omit<SkillAttribute, "staCost"> & {
  /** Override for `deriveKey(name)` collisions. */
  key?: string
  actionTime: number
  hidden?: boolean
  /** Display prefix override; defaults to the skill name. */
  newSkillName?: string
  /** Display suffix override; empty/absent shows the prefix alone. */
  newName?: string
  variants?: Partial<Record<VariantKind, StageVariant>>
  footing?: Footing
}

export type EnrichedSkillAttribute =
  | (EnrichedSkillAttributeBase & {
      // Array ⇒ any-of: gate satisfied when any listed stage qualifies.
      requiresPriorStage: string | string[]
      // Frames. Absent ⇒ prerequisite must immediately precede; present ⇒
      // prerequisite need only have cast earlier on the same character.
      followUpDelay?: number
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
  forteCap: number
  emitPool?: EmitPoolConfig
  template: CharacterTemplate
}
