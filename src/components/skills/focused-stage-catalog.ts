import type {
  EnrichedSkillAttribute,
  SkillGrouping,
  SkillType,
} from "#/types/character"
import type { EnrichedEchoStage } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { getCharacterById, getEchoById } from "../../lib/loadout/catalog"
import {
  makeCharStageId,
  makeEchoStageId,
  stageSkillType,
} from "../../lib/stage"

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

  const allCharacterStages: FocusedStage[] = character.skills
    .filter((skill) => !skill.hidden)
    .flatMap((skill) =>
      skill.stages
        .filter((stage) => stage.name !== "" && !stage.hidden)
        .map((stage, i) =>
          buildCharacterStage(
            character.name,
            skill,
            character.id,
            stage,
            `${skill.id}-${i}`,
          ),
        ),
    )

  const introStages = allCharacterStages.filter(
    (s) => s.skillType === "Intro Skill",
  )
  const outroStages = allCharacterStages.filter(
    (s) => s.skillType === "Outro Skill",
  )
  const restStages = allCharacterStages.filter(
    (s) => s.skillType !== "Intro Skill" && s.skillType !== "Outro Skill",
  )
  const characterStages = [...introStages, ...outroStages, ...restStages]

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
      stageId: makeEchoStageId(echoName, stage.newName),
    },
  }
}

function buildCharacterStage(
  charName: string,
  skill: { name: string; type: SkillGrouping },
  characterId: number,
  stage: EnrichedSkillAttribute,
  key: string,
): FocusedStage {
  const skillType = stageSkillType(stage.category, stage.damage)
  const label = skillLabel(skill.name, stage.newName)
  return {
    key,
    label,
    typeLabel: STAGE_TYPE_LABELS[skillType],
    skillType,
    durationFrames: stage.actionTime,
    clickPayload: {
      characterId,
      stageId: makeCharStageId(
        charName,
        stage.category,
        skill.name,
        stage.newName,
        skillType,
      ),
    },
  }
}

function skillLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}
