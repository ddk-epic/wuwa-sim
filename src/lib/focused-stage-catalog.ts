import type {
  EnrichedSkillAttribute,
  SkillCategory,
  SkillType,
} from "#/types/character"
import type { EnrichedEchoStage } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { getCharacterById, getEchoById } from "./catalog"
import { makeStageId } from "./stage"

export interface FocusedStage {
  key: string
  label: string
  typeLabel: string
  skillType: SkillType
  durationFrames: number
  clickPayload: Omit<TimelineEntry, "id">
}

export interface FocusedStageCatalog {
  echoStages: FocusedStage[]
  characterStages: FocusedStage[]
}

const EMPTY: FocusedStageCatalog = { echoStages: [], characterStages: [] }

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
  const skillType = stage.damage[0]?.type ?? "Echo Skill"
  const label = skillLabel(echoName, stage.newName)
  return {
    key,
    label,
    typeLabel: STAGE_TYPE_LABELS[skillType],
    skillType,
    durationFrames: stage.actionTime,
    clickPayload: {
      characterId,
      stageId: makeStageId(echoName, stage.newName),
    },
  }
}

function buildCharacterStage(
  skill: { name: string; type: SkillCategory },
  characterId: number,
  stage: EnrichedSkillAttribute,
  key: string,
): FocusedStage {
  const skillType = stage.damage?.[0]?.type ?? categoryToSkillType(skill.type)
  const label = skillLabel(skill.name, stage.newName)
  return {
    key,
    label,
    typeLabel: STAGE_TYPE_LABELS[skillType],
    skillType,
    durationFrames: stage.actionTime,
    clickPayload: {
      characterId,
      stageId: makeStageId(skill.name, stage.newName),
    },
  }
}

function skillLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}
