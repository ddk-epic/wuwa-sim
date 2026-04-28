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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { staCost: _staCost, ...rest } = stage
  return rest
}

export function enrichCharacters(
  characters: Character[],
  metadata: Record<number, SkillMetadata>,
): EnrichedCharacter[] {
  return characters.map((char) => ({
    ...char,
    skills: char.skills.map((skill): EnrichedSkill => {
      const base: EnrichedSkill = {
        ...skill,
        stages: skill.stages.map(enrichStage),
      }
      const override = metadata[skill.id]
      if (!override) return base
      return { ...base, ...override }
    }),
  }))
}
