import { ALL_CHARACTERS } from "#/data/characters"
import type { EnrichedCharacter } from "#/types/character"
import type { StageRef } from "./types"

export const CHARACTERS = ALL_CHARACTERS

export function findCharacter(name: string): EnrichedCharacter | undefined {
  return ALL_CHARACTERS.find((c) => c.name === name)
}

export interface StageGroup {
  skill: string
  stages: StageRef[]
}

// Inherent Skills are passives authored as buffs; Movement is the injected
// Dodge/Jump. Neither carries empirical stage timing to measure here.
const EXCLUDED_GROUPINGS = new Set(["Inherent Skill", "Movement"])

/** Flatten a character's skills/stages into pickable StageRefs, grouped by skill. */
export function stageGroups(char: EnrichedCharacter): StageGroup[] {
  return char.skills
    .filter((skill) => !EXCLUDED_GROUPINGS.has(skill.type))
    .map((skill) => ({
      skill: skill.name,
      stages: skill.stages.map((stage) => ({
        id: `${skill.name}::${stage.key ?? stage.name}`,
        skill: skill.name,
        stage: stage.newName?.trim() || stage.name,
        hitCount: stage.damage?.length ?? 0,
      })),
    }))
}
