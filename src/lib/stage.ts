import type { DamageEntry, VariantKind, StageVariant } from "#/types/character"
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
  element: string
  concerto: number
  damage: DamageEntry[]
}

export function stageLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}

export function resolveStage(
  entry: TimelineEntry,
  slots: Slots,
  loadouts: SlotLoadout[],
): ResolvedStage | null {
  if (entry.skillType === "Echo Skill") {
    const slotIndex = slots.findIndex((id) => id === entry.characterId)
    const echoId = slotIndex >= 0 ? (loadouts[slotIndex]?.echoId ?? null) : null
    const echo = echoId !== null ? getEchoById(echoId) : null
    if (!echo) return null
    const stage = echo.skill.stages.find(
      (s) => stageLabel(echo.name, s.newName) === entry.skillName,
    )
    if (!stage) return null
    const id = `${echo.name}::${stage.newName}`
    return {
      stage,
      stageId: id,
      concerto: 0,
      damage: stage.damage,
      element: echo.element,
    }
  }

  const character = getCharacterById(entry.characterId)
  if (!character) return null
  for (const skill of character.skills) {
    if (skill.type !== entry.skillType) continue
    const stage = skill.stages.find(
      (s) => stageLabel(skill.name, s.newName) === entry.skillName,
    )
    if (stage?.damage) {
      const id = `${skill.name}::${stage.newName ?? "_"}`
      return {
        stage,
        stageId: id,
        concerto: stage.concerto ?? 0,
        damage: stage.damage,
        element: character.element,
      }
    }
  }
  return null
}

export function resolveStageExecution(
  stage: ActionTimeStage & { damage?: DamageEntry[] },
  variantKind: VariantKind | undefined,
  reactionDelay: number,
): { duration: number; damage: DamageEntry[] } {
  const allDamage = stage.damage ?? []
  if (!variantKind) return { duration: stage.actionTime, damage: allDamage }
  const variant = stage.variants?.[variantKind]
  if (!variant) return { duration: stage.actionTime, damage: allDamage }
  const duration = variant.actionTime + reactionDelay
  const damage = allDamage.filter((hit) => hit.actionFrame <= duration)
  return { duration, damage }
}

export function resolveActionTime(
  stage: ActionTimeStage,
  variantKind: VariantKind | undefined,
  reactionDelay: number,
): number {
  if (!variantKind) return stage.actionTime
  const variant = stage.variants?.[variantKind]
  if (!variant) return stage.actionTime
  return variant.actionTime + reactionDelay
}
