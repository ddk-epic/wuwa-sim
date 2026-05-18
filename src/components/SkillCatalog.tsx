import { useState, useEffect } from "react"
import type { SkillType } from "#/types/character"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { ELEMENT_BORDER_CLASSES } from "#/data/elements"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { getCharacterById } from "#/lib/catalog"
import { getFocusedStageCatalog } from "#/lib/focused-stage-catalog"
import type { FocusedStage } from "#/lib/focused-stage-catalog"

type NewEntry = Omit<TimelineEntry, "id">

const FILTER_ORDER: Array<SkillType> = [
  "Intro Skill",
  "Basic Attack",
  "Heavy Attack",
  "Resonance Skill",
  "Resonance Liberation",
  "Forte Circuit",
  "Outro Skill",
  "Echo Skill",
  "Movement",
]

interface SkillCatalogProps {
  slots: Slots
  loadouts: SlotLoadout[]
  focusedId: number | null
  onFocus: (id: number) => void
  onStageClick: (entry: NewEntry) => void
  reactionDelay: number
}

export function SkillCatalog({
  slots,
  loadouts,
  focusedId,
  onFocus,
  onStageClick,
  reactionDelay: _reactionDelay,
}: SkillCatalogProps) {
  const [filterType, setFilterType] = useState<SkillType | null>(null)

  useEffect(() => {
    setFilterType(null)
  }, [focusedId])

  const filledCharacters = slots
    .filter((id): id is number => id !== null)
    .map((id) => getCharacterById(id))
    .filter((c): c is EnrichedCharacter => c !== null)

  const { echoStages, characterStages } = getFocusedStageCatalog(
    slots,
    loadouts,
    focusedId,
  )

  const filteredEcho = filterType
    ? echoStages.filter((s) => s.skillType === filterType)
    : echoStages
  const filteredChar = filterType
    ? characterStages.filter((s) => s.skillType === filterType)
    : characterStages

  const showDivider = filteredEcho.length > 0 && filteredChar.length > 0

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
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-gray-700 shrink-0">
        <button
          className={[
            "px-2 py-0.5 rounded text-xs font-mono transition-colors",
            filterType === null
              ? "bg-gray-500 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700",
          ].join(" ")}
          onClick={() => setFilterType(null)}
        >
          all
        </button>
        {FILTER_ORDER.map((type) => (
          <button
            key={type}
            className={[
              "px-2 py-0.5 rounded text-xs font-mono transition-colors",
              filterType === type
                ? "bg-gray-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700",
            ].join(" ")}
            onClick={() => setFilterType(type)}
          >
            {STAGE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredEcho.map((stage) => (
          <StageRow key={stage.key} stage={stage} onStageClick={onStageClick} />
        ))}
        {showDivider && (
          <div
            data-testid="echo-character-divider"
            className="border-b border-gray-600 my-1 mx-2"
          />
        )}
        {filteredChar.map((stage) => (
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
  const durationSec = (stage.durationFrames / 60).toFixed(2) + "s"
  return (
    <button
      className="w-full flex items-center px-2 py-2 text-left hover:bg-gray-800 border-gray-700/50 transition-colors"
      onClick={() => onStageClick(stage.clickPayload)}
    >
      <span className="w-12 pr-2 text-right font-mono text-xs text-gray-500">
        {stage.typeLabel}
      </span>
      <span className="flex-1 text-sm text-gray-200">{stage.label}</span>
      <span className="font-mono text-xs text-gray-500 ml-2">
        {durationSec}
      </span>
    </button>
  )
}
