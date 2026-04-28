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
  metadata: Record<string, SkillMetadata[]>,
): EnrichedCharacter[] {
  return characters.map((char) => ({
    ...char,
    skills: char.skills.map((skill): EnrichedSkill => {
      const skillMeta = metadata[char.name]?.find((m) => m.name === skill.name)
      const stages = skill.stages.map((stage) => {
        const enriched = enrichStage(stage)
        const stageMeta = skillMeta?.stages.find((s) => s.name === stage.name)
        if (!stageMeta) return enriched
        const { name: _name, ...stageOverride } = stageMeta
        return { ...enriched, ...stageOverride }
      })
      const base: EnrichedSkill = { ...skill, stages }
      if (!skillMeta) return base
      return skillMeta.hidden !== undefined
        ? { ...base, hidden: skillMeta.hidden }
        : base
    }),
  }))
}
