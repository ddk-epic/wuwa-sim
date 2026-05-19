import type { Element } from "#/data/elements"
import type {
  DamageEntry,
  MovementKind,
  SkillCategory,
  SkillType,
  VariantKind,
  StageVariant,
} from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById, getEchoById } from "./catalog"

export interface ActionTimeStage {
  actionTime: number
  variants?: Partial<Record<VariantKind, StageVariant>>
}

export interface ResolvedStage {
  stage: ActionTimeStage & { damage?: DamageEntry[] }
  stageId: string
  stageName: string
  element: Element
  concerto: number
  resonanceCost?: number
  damage: DamageEntry[]
  skillType: SkillType
  skillName: string
  requiresStageId?: string
  comboAllows?: readonly MovementKind[]
}

export function makeStageId(baseName: string, newName?: string): string {
  return `${baseName}::${newName ?? "_"}`
}

export function stageLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}

function categoryToSkillType(cat: SkillCategory): SkillType {
  if (
    cat === "Normal Attack" ||
    cat === "Inherent Skill" ||
    cat === "Tune Break"
  ) {
    return "Basic Attack"
  }
  // Movement self-routes — no roll-up
  return cat
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
        if (makeStageId(skill.name, s.newName) === entry.stageId) {
          const comboAllows =
            s.requiresStageId !== undefined
              ? (
                  s as {
                    requiresStageId: string
                    comboAllows?: readonly MovementKind[]
                  }
                ).comboAllows
              : undefined
          return {
            stage: s,
            stageId: entry.stageId,
            stageName: s.name,
            element: character.element,
            concerto: s.concerto ?? 0,
            resonanceCost: skill.resonanceCost,
            damage: s.damage ?? [],
            skillType: s.damage?.[0]?.type ?? categoryToSkillType(skill.type),
            skillName: stageLabel(skill.name, s.newName),
            requiresStageId: s.requiresStageId,
            comboAllows,
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
      if (makeStageId(echo.name, s.newName) === entry.stageId) {
        return {
          stage: s,
          stageId: entry.stageId,
          stageName: s.name,
          element: echo.element,
          concerto: 0,
          damage: s.damage,
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
): { advance: number; hits: DamageEntry[] } {
  const allDamage = stage.damage ?? []
  if (!variantKind) return { advance: stage.actionTime, hits: allDamage }
  if (variantKind === "swap") {
    const variant = stage.variants?.swap
    const advance =
      variant !== undefined ? variant.actionTime + reactionDelay : swapFrames
    return { advance, hits: allDamage }
  }
  const variant = stage.variants?.[variantKind]
  if (!variant) return { advance: stage.actionTime, hits: allDamage }
  const advance = variant.actionTime + reactionDelay
  const hits = allDamage.filter((hit) => hit.actionFrame <= advance)
  return { advance, hits }
}

export function resolveActionTime(
  stage: ActionTimeStage,
  variantKind: VariantKind | undefined,
  reactionDelay: number,
  swapFrames: number = 6,
): number {
  if (!variantKind) return stage.actionTime
  if (variantKind === "swap") {
    const variant = stage.variants?.swap
    return variant !== undefined
      ? variant.actionTime + reactionDelay
      : swapFrames
  }
  const variant = stage.variants?.[variantKind]
  if (!variant) return stage.actionTime
  return variant.actionTime + reactionDelay
}
