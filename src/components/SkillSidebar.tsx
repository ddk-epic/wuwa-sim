import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { ELEMENT_BORDER_CLASSES } from "#/data/elements"
import { getCharacterById } from "#/lib/catalog"
import {
  getFocusedStageCatalog,
  type FocusedStage,
} from "#/lib/focused-stage-catalog"

type NewEntry = Omit<TimelineEntry, "id">

interface SkillSidebarProps {
  slots: Slots
  loadouts: SlotLoadout[]
  focusedId: number | null
  onFocus: (id: number) => void
  onStageClick: (entry: NewEntry) => void
}

export function SkillSidebar({
  slots,
  loadouts,
  focusedId,
  onFocus,
  onStageClick,
}: SkillSidebarProps) {
  const filledCharacters = slots
    .filter((id): id is number => id !== null)
    .map((id) => getCharacterById(id))
    .filter((c): c is EnrichedCharacter => c !== null)

  const { echoStages, characterStages } = getFocusedStageCatalog(
    slots,
    loadouts,
    focusedId,
  )

  const showDivider = echoStages.length > 0 && characterStages.length > 0

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex border-b border-gray-700 shrink-0">
        {filledCharacters.map((character) => {
          const isFocused = character.id === focusedId
          const borderClass =
            ELEMENT_BORDER_CLASSES[character.element] ?? "border-gray-500"
          return (
            <button
              key={character.id}
              className={[
                "flex-1 px-3 py-2 text-center border-b-2 transition-colors",
                isFocused
                  ? `${borderClass} text-white`
                  : "border-gray-700 text-gray-400 hover:text-gray-200",
              ].join(" ")}
              onClick={() => onFocus(character.id)}
            >
              <div className="font-bold text-lg truncate">{character.name}</div>
              <div className="text-sm text-gray-400">{character.element}</div>
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        {echoStages.map((stage) => (
          <StageRow key={stage.key} stage={stage} onStageClick={onStageClick} />
        ))}
        {showDivider && (
          <div
            data-testid="echo-character-divider"
            className="border-b border-gray-600 my-1 mx-2"
          />
        )}
        {characterStages.map((stage) => (
          <StageRow key={stage.key} stage={stage} onStageClick={onStageClick} />
        ))}
      </div>
    </div>
  )
}

interface StageRowProps {
  stage: FocusedStage
  onStageClick: (entry: NewEntry) => void
}

function StageRow({ stage, onStageClick }: StageRowProps) {
  return (
    <button
      className="w-full flex items-center px-2 py-2 text-left hover:bg-gray-800 border-gray-700/50 transition-colors"
      onClick={() => onStageClick(stage.clickPayload)}
    >
      <span className="w-12 pr-2 text-right font-mono text-xs text-gray-500">
        {stage.typeLabel}
      </span>
      <span className="flex-1 text-sm text-gray-200">{stage.label}</span>
    </button>
  )
}
