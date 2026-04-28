import type { Character, Skill, SkillAttribute } from '#/types/character'
import type { Slots } from '#/types/loadout'
import type { TimelineEntry } from '#/types/timeline'
import { ELEMENT_BORDER_CLASSES } from '#/data/elements'

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
  slots: Slots
  characters: Character[]
  focusedId: number | null
  onFocus: (id: number) => void
  onStageClick: (entry: NewEntry) => void
}

export function SkillSidebar({
  slots,
  characters,
  focusedId,
  onFocus,
  onStageClick,
}: SkillSidebarProps) {
  const filledCharacters = slots
    .filter((id): id is number => id !== null)
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => c !== undefined)

  const focusedCharacter =
    filledCharacters.find((c) => c.id === focusedId) ?? null

  const skills =
    focusedCharacter?.skills.filter((s) => RELEVANT_SKILL_TYPES.has(s.type)) ??
    []

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex border-b border-gray-700 shrink-0">
        {filledCharacters.map((character) => {
          const isFocused = character.id === focusedId
          const borderClass =
            ELEMENT_BORDER_CLASSES[character.element] ?? 'border-gray-500'
          return (
            <button
              key={character.id}
              className={[
                'px-3 py-2 text-left border-b-2 transition-colors',
                isFocused
                  ? `${borderClass} text-white`
                  : 'border-gray-700 text-gray-400 hover:text-gray-200',
              ].join(' ')}
              onClick={() => onFocus(character.id)}
            >
              <div className="text-xs font-medium truncate">
                {character.name}
              </div>
              <div className="text-[10px] text-gray-400">
                {character.element}
              </div>
            </button>
          )
        })}
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
                characterId={focusedCharacter?.id ?? 0}
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
