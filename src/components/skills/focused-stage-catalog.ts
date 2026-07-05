import type { SkillCategory, SkillGrouping, SkillType } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { getCharacterById, getEchoById } from "../../lib/loadout/catalog"
import type { EchoStageInfo, StageInfo } from "../../lib/compile-character"
import { compileCharacter, compileEcho } from "../../lib/compile-character"
import { resolveStageLabel, stageLabel } from "../../lib/stage"

export interface FocusedStage {
  key: string
  label: string
  typeLabel: string
  skillType: SkillType
  skillGrouping: SkillGrouping
  skillCategory: SkillCategory
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
  const sequence = slotIndex >= 0 ? (loadouts[slotIndex]?.sequence ?? 0) : 0

  const echoStages: FocusedStage[] = echo
    ? [...compileEcho(echo).stageIndex.values()]
        .filter((info) => !info.stage.hidden)
        .map((info) => buildEchoStage(echo.name, character.id, info))
    : []

  const allCharacterStages: FocusedStage[] = [
    ...compileCharacter(character).stageIndex.values(),
  ]
    .filter(
      (info) =>
        !info.skill.hidden &&
        !info.stage.hidden &&
        info.stage.name !== "" &&
        (info.stage.requiresSequence ?? 0) <= sequence,
    )
    .map((info) => buildCharacterStage(character.id, info))

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
  info: EchoStageInfo,
): FocusedStage {
  const { stage } = info
  const skillType = stage.damage[0]?.type ?? "Echo Skill"
  return {
    key: info.stageId,
    label: stageLabel(echoName, stage.newName),
    typeLabel: STAGE_TYPE_LABELS["Echo Skill"],
    skillType,
    skillGrouping: "Echo Skill",
    skillCategory: "Echo Skill",
    durationFrames: stage.actionTime,
    clickPayload: { characterId, stageId: info.stageId },
  }
}

function buildCharacterStage(
  characterId: number,
  info: StageInfo,
): FocusedStage {
  const { skill, stage } = info
  return {
    key: info.stageId,
    label: resolveStageLabel(skill.name, stage),
    typeLabel: STAGE_TYPE_LABELS[stage.category],
    skillType: info.skillType,
    skillGrouping: skill.type,
    skillCategory: stage.category,
    durationFrames: stage.actionTime,
    clickPayload: { characterId, stageId: info.stageId },
  }
}
