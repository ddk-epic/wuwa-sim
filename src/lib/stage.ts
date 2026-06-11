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
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById, getEchoById } from "./loadout/catalog"

export const STAGE_CAST_NAME = "Skill DMG"

/**
 * The footing a stage begins on (its "entry footing"). Sustained values enter
 * as-is; a `{ launch }` starts on the **ground** (it launches _from_ the ground,
 * so an airborne character must fall first), a `{ land }` starts in the **air**.
 * Omission is footing-transparent — no entry requirement. See
 * `references/footing.md` ("Falling").
 */
export function stageEntryFooting(
  footing: Footing | undefined,
): "ground" | "air" | undefined {
  if (footing === undefined) return undefined
  if (footing === "air") return "air"
  if (typeof footing === "object" && "land" in footing) return "air"
  return "ground" // sustained "ground" or { launch }
}

function toKebab(s: string | undefined): string {
  if (!s) return "_"
  const k = s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return k || "_"
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
  element: Element
  concerto: number
  resonanceCost?: number
  damage: DamageEntry[]
  skillGrouping: SkillGrouping
  skillCategory: SkillCategory
  skillType: SkillType
  skillName: string
  requiresPriorStageId?: string
  minDelay?: number
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

/** `char.<charName>.<skill-category>.<skillName>.<stageName>::<skill-type>` */
export function makeCharStageId(
  charName: string,
  skillCategory: SkillCategory,
  skillName: string,
  stageName: string | undefined,
  skillType: SkillType,
): string {
  return `char.${toKebab(charName)}.${toKebab(skillCategory)}.${toKebab(skillName)}.${toKebab(stageName)}::${toKebab(skillType)}`
}

/** `echo.<echoName>.<stageName>::echo-skill` */
export function makeEchoStageId(
  echoName: string,
  stageName: string | undefined,
): string {
  return `echo.${toKebab(echoName)}.${toKebab(stageName)}::echo-skill`
}

/**
 * Match a stageId filter `t` against a concrete hit stageId `sid`. A `t` that
 * ends in a `.<hitIndex>` suffix requires an exact match; otherwise `t` is a
 * lineage prefix that matches every hit of the stage (and of descendant
 * stages).
 */
export function stageIdMatches(t: string, sid: string): boolean {
  if (sid === t) return true
  // Trigger `.<digits>` suffix targets a specific hit — require exact match.
  if (/\.\d+$/.test(t)) return false
  const sidNoHit = sid.replace(/\.\d+$/, "")
  if (sidNoHit === t) return true
  const sidLineage = sidNoHit.includes("::")
    ? sidNoHit.slice(0, sidNoHit.indexOf("::"))
    : sidNoHit
  const tLineage = t.includes("::") ? t.slice(0, t.indexOf("::")) : t
  if (sidLineage === tLineage) return true
  return sidLineage.startsWith(tLineage + ".")
}

export function stageLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}

export function findStageByEntry(
  entry: TimelineEntry,
  slots: Slots,
  loadouts: SlotLoadout[],
): ResolvedStage | null {
  const character = getCharacterById(entry.characterId)

  if (character) {
    for (const skill of character.skills) {
      for (const s of skill.stages) {
        const stageType = stageSkillType(s.category, s.damage)
        if (
          makeCharStageId(
            character.name,
            s.category,
            skill.name,
            s.newName,
            stageType,
          ) === entry.stageId
        ) {
          const isCastStage = s.name === STAGE_CAST_NAME
          // Stage-level skillType, collapsed from the parent skill grouping.
          // Grouping-only labels that are not SkillTypes (Normal Attack,
          // Inherent Skill, Tune Break, Forte Circuit) collapse to "Basic Attack".
          // Independent of skillCategory (the trigger axis); per-hit damage type
          // lives on each DamageEntry.type.
          const skillType: SkillType =
            skill.type === "Normal Attack" ||
            skill.type === "Inherent Skill" ||
            skill.type === "Tune Break" ||
            skill.type === "Forte Circuit"
              ? "Basic Attack"
              : skill.type
          return {
            stage: s,
            stageId: entry.stageId,
            stageName: s.name,
            element: character.element,
            concerto:
              (s.concerto ?? 0) + (isCastStage ? (skill.concerto ?? 0) : 0),
            resonanceCost: skill.resonanceCost,
            damage: s.damage ?? [],
            skillGrouping: skill.type,
            skillCategory: s.category,
            skillType,
            skillName: isCastStage
              ? skill.name
              : stageLabel(skill.name, s.newName),
            requiresPriorStageId: s.requiresPriorStageId,
            minDelay:
              s.requiresPriorStageId !== undefined ? s.minDelay : undefined,
          }
        }
      }
    }
  }

  const slotIndex = slots.findIndex((id) => id === entry.characterId)
  const echoId = slotIndex >= 0 ? (loadouts[slotIndex]?.echoId ?? null) : null
  const echo = echoId !== null ? getEchoById(echoId) : null
  if (echo) {
    for (const s of echo.skill.stages) {
      if (makeEchoStageId(echo.name, s.newName) === entry.stageId) {
        return {
          stage: s,
          stageId: entry.stageId,
          stageName: s.name,
          element: echo.element,
          concerto: 0,
          damage: s.damage,
          skillGrouping: "Echo Skill",
          skillCategory: "Echo Skill",
          skillType: "Echo Skill",
          skillName: stageLabel(echo.name, s.newName),
        }
      }
    }
  }

  return null
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
