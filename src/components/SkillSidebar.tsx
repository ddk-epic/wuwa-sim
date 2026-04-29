import type {
  EnrichedCharacter,
  EnrichedSkill,
  DamageEntry,
} from '#/types/character'
import type { SlotLoadout, Slots } from '#/types/loadout'
import type { EnrichedEcho } from '#/types/echo'
import type { TimelineEntry } from '#/types/timeline'
import { ELEMENT_BORDER_CLASSES } from '#/data/elements'
import { STAGE_TYPE_LABELS } from '#/data/skill-types'

type NewEntry = Omit<TimelineEntry, 'id'>

interface SkillInfo {
  name: string
  type: string
}

interface StageInfo {
  newName?: string
  actionTime: number
  damage?: DamageEntry[]
}

interface SkillSidebarProps {
  slots: Slots
  loadouts: SlotLoadout[]
  echoes: EnrichedEcho[]
  characters: EnrichedCharacter[]
  focusedId: number | null
  onFocus: (id: number) => void
  onStageClick: (entry: NewEntry) => void
}

export function SkillSidebar({
  slots,
  loadouts,
  echoes,
  characters,
  focusedId,
  onFocus,
  onStageClick,
}: SkillSidebarProps) {
  const filledCharacters = slots
    .filter((id): id is number => id !== null)
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is EnrichedCharacter => c !== undefined)

  const focusedCharacter =
    filledCharacters.find((c) => c.id === focusedId) ?? null

  const focusedSlotIndex = slots.findIndex((id) => id === focusedId)
  const echoId =
    focusedSlotIndex >= 0 ? (loadouts[focusedSlotIndex]?.echoId ?? null) : null
  const focusedEcho =
    echoId !== null ? (echoes.find((e) => e.id === echoId) ?? null) : null

  const echoStages = focusedEcho?.skill.stages.filter((s) => !s.hidden) ?? []

  const skills: EnrichedSkill[] =
    focusedCharacter?.skills.filter((s) => !s.hidden) ?? []

  const hasEchoStages = echoStages.length > 0
  const hasCharacterStages = skills.some(
    (s) => s.stages.filter((st) => st.name !== '' && !st.hidden).length > 0,
  )

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
                'flex-1 px-3 py-2 text-center border-b-2 transition-colors',
                isFocused
                  ? `${borderClass} text-white`
                  : 'border-gray-700 text-gray-400 hover:text-gray-200',
              ].join(' ')}
              onClick={() => onFocus(character.id)}
            >
              <div className="font-bold text-lg truncate">{character.name}</div>
              <div className="text-sm text-gray-400">{character.element}</div>
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        {hasEchoStages &&
          focusedEcho !== null &&
          echoStages.map((stage, i) => (
            <StageRow
              key={`echo-${i}`}
              skill={{ name: focusedEcho.name, type: 'Echo Skill' }}
              stage={stage}
              characterId={focusedCharacter?.id ?? 0}
              onStageClick={onStageClick}
            />
          ))}
        {hasEchoStages && hasCharacterStages && (
          <div className="border-b border-gray-600 my-1 mx-2" />
        )}
        {skills.flatMap((skill) =>
          skill.stages
            .filter((stage) => stage.name !== '' && !stage.hidden)
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
  skill: SkillInfo
  stage: StageInfo
  characterId: number
  onStageClick: (entry: NewEntry) => void
}

function StageRow({ skill, stage, characterId, onStageClick }: StageRowProps) {
  const attackType = stage.damage?.[0]?.type ?? skill.type
  const typeLabel = STAGE_TYPE_LABELS[attackType] ?? ''

  function handleClick() {
    const multiplier = (stage.damage ?? []).reduce((sum, d) => sum + d.value, 0)
    onStageClick({
      characterId,
      skillType: skill.type,
      skillName: stage.newName
        ? `${skill.name} · ${stage.newName}`
        : skill.name,
      attackType,
      actionTime: stage.actionTime,
      multiplier,
    })
  }

  return (
    <button
      className="w-full flex items-center px-2 py-2 text-left hover:bg-gray-800 border-gray-700/50 transition-colors"
      onClick={handleClick}
    >
      <span className="w-12 pr-2 text-right font-mono text-xs text-gray-500">
        {typeLabel}
      </span>
      <span className="flex-1 text-sm text-gray-200">
        {stage.newName ? `${skill.name} · ${stage.newName}` : skill.name}
      </span>
    </button>
  )
}
