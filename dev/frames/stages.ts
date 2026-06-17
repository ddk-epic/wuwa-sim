import { ALL_CHARACTERS } from "#/data/characters"
import type {
  EnrichedCharacter,
  EnrichedSkill,
  EnrichedSkillAttribute,
  SkillGrouping,
} from "#/types/character"
import type { StageRef } from "./types"

export const CHARACTERS = ALL_CHARACTERS

export function findCharacter(name: string): EnrichedCharacter | undefined {
  return ALL_CHARACTERS.find((c) => c.name === name)
}

export interface StageGroup {
  skill: string
  type: SkillGrouping
  stages: StageRef[]
}

// Inherent Skills are passives authored as buffs; Movement is the injected
// Dodge/Jump. Neither carries empirical stage timing to measure here.
const EXCLUDED_GROUPINGS = new Set(["Inherent Skill", "Movement"])

/** A skill the frame tool measures: visible, and not a passive/movement grouping. */
export function isMeasurableSkill(skill: EnrichedSkill): boolean {
  return !EXCLUDED_GROUPINGS.has(skill.type) && !skill.hidden
}

/** A stage the frame tool measures: visible, with a real name. */
export function isMeasurableStage(stage: EnrichedSkillAttribute): boolean {
  return !stage.hidden && stage.name !== ""
}

/** The solve-identity ref for a stage. The `id` must match across catalog and clips. */
export function stageRefOf(
  skillName: string,
  stage: EnrichedSkillAttribute,
): StageRef {
  return {
    id: `${skillName}::${stage.key ?? stage.name}`,
    skill: skillName,
    stage: stage.newName?.trim() || stage.name,
    hitCount: stage.damage?.length ?? 0,
  }
}

/** Flatten a character's skills/stages into pickable StageRefs, grouped by skill. */
export function stageGroups(char: EnrichedCharacter): StageGroup[] {
  return char.skills
    .filter(isMeasurableSkill)
    .map((skill) => ({
      skill: skill.name,
      type: skill.type,
      stages: skill.stages
        .filter(isMeasurableStage)
        .map((stage) => stageRefOf(skill.name, stage)),
    }))
    .filter((group) => group.stages.length > 0)
}
