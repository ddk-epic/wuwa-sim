import type {
  Character,
  EnrichedCharacter,
  EnrichedSkill,
  EnrichedSkillAttribute,
  SkillMetadata,
} from '#/types/character'

function enrichStage(
  stage: Character['skills'][number]['stages'][number],
): EnrichedSkillAttribute {
  const { staCost: _staCost, ...rest } = stage
  return { ...rest, actionTime: 0 }
}

export function enrichCharacters(
  characters: Character[],
  metadata: Record<number, SkillMetadata>,
): EnrichedCharacter[] {
  return characters.map((char) => ({
    ...char,
    skills: char.skills.map((skill): EnrichedSkill => {
      const override = metadata[skill.id]
      const stageOverrides = override?.stageOverrides
      const stages = skill.stages.map((stage) => {
        const enriched = enrichStage(stage)
        const stageOverride = stageOverrides?.[stage.name]
        return stageOverride ? { ...enriched, ...stageOverride } : enriched
      })
      const base: EnrichedSkill = { ...skill, stages }
      if (!override) return base

      const { stageOverrides: _stageOverrides, ...skillOverride } = override
      return { ...base, ...skillOverride }
    }),
  }))
}
