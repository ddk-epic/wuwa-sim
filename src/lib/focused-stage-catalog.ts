import type { EnrichedSkillAttribute } from "#/types/character"
import type { EnrichedEchoStage } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { getCharacterById, getEchoById } from "./catalog"

export interface FocusedStage {
  key: string
  label: string
  typeLabel: string
  clickPayload: Omit<TimelineEntry, "id">
}

export interface FocusedStageCatalog {
  echoStages: FocusedStage[]
  characterStages: FocusedStage[]
}

const EMPTY: FocusedStageCatalog = { echoStages: [], characterStages: [] }

export function getFocusedStageCatalog(
  slots: Slots,
  loadouts: SlotLoadout[],
  focusedId: number | null,
): FocusedStageCatalog {
  if (focusedId === null) return EMPTY
  if (!slots.includes(focusedId)) return EMPTY

  const character = getCharacterById(focusedId)
  if (!character) return EMPTY

  const slotIndex = slots.findIndex((id) => id === focusedId)
  const echoId = slotIndex >= 0 ? (loadouts[slotIndex]?.echoId ?? null) : null
  const echo = echoId !== null ? getEchoById(echoId) : null

  const echoStages: FocusedStage[] = echo
    ? echo.skill.stages
        .filter((stage) => !stage.hidden)
        .map((stage, i) =>
          buildEchoStage(echo.name, character.id, stage, `echo-${i}`),
        )
    : []

  const characterStages: FocusedStage[] = character.skills
    .filter((skill) => !skill.hidden)
    .flatMap((skill) =>
      skill.stages
        .filter((stage) => stage.name !== "" && !stage.hidden)
        .map((stage, i) =>
          buildCharacterStage(skill, character.id, stage, `${skill.id}-${i}`),
        ),
    )

  return { echoStages, characterStages }
}

function buildEchoStage(
  echoName: string,
  characterId: number,
  stage: EnrichedEchoStage,
  key: string,
): FocusedStage {
  const attackType = deriveAttackType(stage.damage, "Echo Skill")
  const label = skillLabel(echoName, stage.newName)
  const multiplier = sumMultiplier(stage.damage)
  return {
    key,
    label,
    typeLabel: STAGE_TYPE_LABELS[attackType] ?? "",
    clickPayload: {
      characterId,
      skillType: "Echo Skill",
      skillName: label,
      attackType,
      actionTime: stage.actionTime,
      multiplier,
    },
  }
}

function buildCharacterStage(
  skill: { name: string; type: string },
  characterId: number,
  stage: EnrichedSkillAttribute,
  key: string,
): FocusedStage {
  const attackType = deriveAttackType(stage.damage, skill.type)
  const label = skillLabel(skill.name, stage.newName)
  const multiplier = sumMultiplier(stage.damage)
  return {
    key,
    label,
    typeLabel: STAGE_TYPE_LABELS[attackType] ?? "",
    clickPayload: {
      characterId,
      skillType: skill.type,
      skillName: label,
      attackType,
      actionTime: stage.actionTime,
      multiplier,
    },
  }
}

function deriveAttackType(
  damage: { type: string }[] | undefined,
  fallback: string,
): string {
  return damage?.[0]?.type ?? fallback
}

function sumMultiplier(damage: { value: number }[] | undefined): number {
  return (damage ?? []).reduce((sum, d) => sum + d.value, 0)
}

function skillLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}
