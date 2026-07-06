import type { Element } from "#/data/elements"
import type {
  DamageEntry,
  Footing,
  SkillCategory,
  SkillGrouping,
  SkillType,
  VariantKind,
  StageVariant,
} from "#/types/character"

export const STAGE_CAST_NAME = "Skill DMG"

// Reserved prior-stage token: not a real stageId. Chain gate satisfied when the
// actor is a fresh swap-in. Real stageIds are dotted/colon-namespaced, so the
// bare token never collides.
export const SWAP_IN_SENTINEL = "swap-in"

/**
 * The footing a stage begins on (its "entry footing"). Omission means `ground`:
 * an untagged stage requires the ground, so an airborne character falls first.
 * A transition's `entry` drives this directly; `entry: "any"` carries no entry
 * requirement (like `"either"`). See `references/footing.md` ("Falling").
 */
export function stageEntryFooting(
  footing: Footing | undefined,
): "ground" | "air" | undefined {
  if (footing === "either") return undefined
  if (footing === "air") return "air"
  if (typeof footing === "object")
    return footing.entry === "any" ? undefined : footing.entry
  return "ground" // omitted or sustained "ground"
}

/**
 * The footing a stage ends on (its "exit footing"). Omission settles to
 * `ground`. A transition's `exit` drives this directly; sustained values exit
 * as-is. Only `"either"` is footing-transparent — it preserves the entry footing.
 */
export function stageExitFooting(
  footing: Footing | undefined,
): "ground" | "air" | undefined {
  if (footing === "either") return undefined
  if (footing === "air") return "air"
  if (typeof footing === "object") return footing.exit
  return "ground" // omitted or sustained "ground"
}

export function toKebab(s: string | undefined): string {
  if (!s) return "_"
  const k = s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return k || "_"
}

const CAST_STAGE_NAMES = new Set([STAGE_CAST_NAME, "Outro DMG"])

/** Stage/skill key from the API `name`: trailing " DMG"/" Damage" stripped, cast stages normalized to `cast`. */
export function deriveKey(name: string): string {
  if (CAST_STAGE_NAMES.has(name)) return "cast"
  return toKebab(name.replace(/ (DMG|Damage)$/, ""))
}

export interface ActionTimeStage {
  actionTime: number
  variants?: Partial<Record<VariantKind, StageVariant>>
  footing?: Footing
  /** Wall-clock frames (at 60fps) for a cutscene animation. Engine clock does not advance. */
  animationFrames?: number
}

export interface ResolvedStage {
  stage: ActionTimeStage & { damage?: DamageEntry[] }
  stageId: string
  stageName: string
  skillKey?: string
  element: Element
  concerto: number
  forte?: number
  resonanceCost?: number
  damage: DamageEntry[]
  skillGrouping: SkillGrouping
  skillCategory: SkillCategory
  skillType: SkillType
  skillName: string
  requiresPriorStageId?: string[]
  requiresSequence?: number
  requiresConcerto?: number
  /** Frames a windowed follow-up must wait past its prerequisite's cast. */
  followUpDelay?: number
  /** Skill-keyed cooldown; unset on a same-skill follow-up (it continues the cast). */
  skillCooldown?: number
  /** Seconds independent to this stage (stage-keyed cooldown). */
  cooldown?: number
}

/** Derive the `::skill-type` segment of a character stageId. */
export function stageSkillType(
  category: SkillCategory,
  damage: DamageEntry[] | undefined,
): SkillType {
  const fallback: SkillType =
    category === "Tune Break" ? "Basic Attack" : category
  return damage?.[0]?.type ?? fallback
}

export function stageLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}

/** A stage's label: its `newSkillName` prefix (default `skillName`) joined with `newName`. */
export function resolveStageLabel(
  skillName: string,
  stage: { newSkillName?: string; newName?: string },
): string {
  return stageLabel(stage.newSkillName ?? skillName, stage.newName)
}

export function resolveStageExecution(
  stage: ActionTimeStage & { damage?: DamageEntry[] },
  variantKind: VariantKind | undefined,
  reactionDelay: number,
  swapFrames: number = 6,
  variantFloor: number = 0,
): { advance: number; hits: DamageEntry[]; react: number; floor: number } {
  const allDamage = stage.damage ?? []
  if (!variantKind)
    return { advance: stage.actionTime, hits: allDamage, react: 0, floor: 0 }
  if (variantKind === "swap") {
    const variant = stage.variants?.swap
    const authored = variant !== undefined
    if (!authored) {
      return { advance: swapFrames, hits: allDamage, react: 0, floor: 0 }
    }
    const reactResult = variant.actionTime + reactionDelay
    const advance = Math.max(reactResult, variantFloor)
    const floorWon = variantFloor > reactResult
    return {
      advance,
      hits: allDamage,
      react: floorWon ? 0 : reactionDelay,
      floor: floorWon ? variantFloor : 0,
    }
  }
  const variant = stage.variants?.[variantKind]
  if (!variant)
    return { advance: stage.actionTime, hits: allDamage, react: 0, floor: 0 }
  const reactResult = variant.actionTime + reactionDelay
  const advance = Math.max(reactResult, variantFloor)
  const floorWon = variantFloor > reactResult
  const hits = allDamage.filter(
    (hit) => hit.actionFrame <= advance || hit.independent,
  )
  return {
    advance,
    hits,
    react: floorWon ? 0 : reactionDelay,
    floor: floorWon ? variantFloor : 0,
  }
}

/** Cycle order for the Variant Kind toggle: FULL → CNCL → INST → SWAP → FULL. */
const VARIANT_ORDER: (VariantKind | undefined)[] = [
  undefined,
  "cancel",
  "instantCancel",
  "swap",
]

/**
 * The next Variant Kind in the toggle cycle, skipping kinds the stage does not
 * author. `undefined` (FULL) is always offered.
 */
export function nextVariant(
  current: VariantKind | undefined,
  stage: ActionTimeStage,
): VariantKind | undefined {
  const defined = VARIANT_ORDER.filter(
    (v) => v === undefined || stage.variants?.[v] !== undefined,
  )
  const idx = defined.indexOf(current)
  return defined[(idx + 1) % defined.length]
}
