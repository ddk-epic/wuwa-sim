import type { Character, Skill, SkillAttribute } from '#/types/character'
import type { TimelineEntry } from '#/types/timeline'

const RELEVANT_SKILL_TYPES = new Set([
  'Normal Attack',
  'Resonance Skill',
  'Resonance Liberation',
  'Forte Circuit',
  'Intro Skill',
  'Outro Skill',
  'Tune Break',
])

type NewEntry = Omit<TimelineEntry, 'id'>

interface SkillSidebarProps {
  character: Character
  onStageClick: (entry: NewEntry) => void
}

export function SkillSidebar({ character, onStageClick }: SkillSidebarProps) {
  const skills = character.skills.filter((s) =>
    RELEVANT_SKILL_TYPES.has(s.type),
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-gray-700 shrink-0">
        <div className="font-bold text-lg">{character.name}</div>
        <div className="text-sm text-gray-400">
          {character.element} · {character.rarity}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {skills.flatMap((skill) =>
          skill.stages
            .filter((stage) => stage.name !== '')
            .map((stage, i) => (
              <StageRow
                key={`${skill.id}-${i}`}
                skill={skill}
                stage={stage}
                characterId={character.id}
                onStageClick={onStageClick}
              />
            )),
        )}
      </div>
    </div>
  )
}

interface StageRowProps {
  skill: Skill
  stage: SkillAttribute
  characterId: number
  onStageClick: (entry: NewEntry) => void
}

function StageRow({ skill, stage, characterId, onStageClick }: StageRowProps) {
  function handleClick() {
    const multiplier = (stage.damage ?? []).reduce((sum, d) => sum + d.value, 0)
    const attackType = stage.damage?.[0]?.type ?? skill.type
    onStageClick({
      characterId,
      skillType: skill.type,
      skillName: `${skill.name} · ${stage.name}`,
      attackType,
      duration: skill.duration ?? 0,
      multiplier,
    })
  }

  return (
    <button
      className="w-full flex flex-col px-4 py-2 text-left hover:bg-gray-800 border-b border-gray-700/50 transition-colors"
      onClick={handleClick}
    >
      <span className="text-xs text-gray-400">{skill.name}</span>
      <span className="text-sm text-gray-200">{stage.name}</span>
    </button>
  )
}
