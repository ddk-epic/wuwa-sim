import { useState, useEffect } from "react"
import type { EnrichedCharacter } from "#/types/character"
import type { TimelineEntry } from "#/types/timeline"
import { useAtomValue, useSetAtom } from "jotai"
import {
  slotsAtom,
  loadoutsAtom,
  focusedIdAtom,
  focusCharacterAtom,
} from "#/state/team"
import { elementHex } from "#/components/ui/character-visual"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { getCharacterById } from "#/lib/loadout/catalog"
import { getFocusedStageCatalog } from "#/components/skills/focused-stage-catalog"
import type { FocusedStage } from "#/components/skills/focused-stage-catalog"
import { formatFrames } from "#/lib/format"

type NewEntry = Omit<TimelineEntry, "id">

type FilterKey =
  | "Normal Attack"
  | "Resonance Skill"
  | "Resonance Liberation"
  | "Forte Circuit"
  | "in-out"
  | "Echo Skill"
  | "Movement"

const FILTER_PREDICATES: Record<FilterKey, (s: FocusedStage) => boolean> = {
  "Normal Attack": (s) => s.skillGrouping === "Normal Attack",
  "Resonance Skill": (s) => s.skillGrouping === "Resonance Skill",
  "Resonance Liberation": (s) => s.skillGrouping === "Resonance Liberation",
  "Forte Circuit": (s) => s.skillGrouping === "Forte Circuit",
  "in-out": (s) =>
    s.skillGrouping === "Intro Skill" || s.skillGrouping === "Outro Skill",
  "Echo Skill": (s) => s.skillGrouping === "Echo Skill",
  Movement: (s) => s.skillGrouping === "Movement",
}

const FILTER_CHIPS: Array<{ key: FilterKey; label: string }> = [
  { key: "in-out", label: "IN/OUT" },
  { key: "Normal Attack", label: STAGE_TYPE_LABELS["Normal Attack"] },
  { key: "Resonance Skill", label: STAGE_TYPE_LABELS["Resonance Skill"] },
  {
    key: "Resonance Liberation",
    label: STAGE_TYPE_LABELS["Resonance Liberation"],
  },
  { key: "Forte Circuit", label: STAGE_TYPE_LABELS["Forte Circuit"] },
  { key: "Echo Skill", label: STAGE_TYPE_LABELS["Echo Skill"] },
  { key: "Movement", label: STAGE_TYPE_LABELS["Movement"] },
]

interface SkillCatalogProps {
  onStageClick: (entry: NewEntry) => void
}

export function SkillCatalog({ onStageClick }: SkillCatalogProps) {
  const slots = useAtomValue(slotsAtom)
  const loadouts = useAtomValue(loadoutsAtom)
  const focusedId = useAtomValue(focusedIdAtom)
  const onFocus = useSetAtom(focusCharacterAtom)
  const [filterKey, setFilterKey] = useState<FilterKey | null>(null)

  useEffect(() => {
    setFilterKey(null)
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

  const filteredEcho = filterKey
    ? echoStages.filter(FILTER_PREDICATES[filterKey])
    : echoStages
  const filteredChar = filterKey
    ? characterStages.filter(FILTER_PREDICATES[filterKey])
    : characterStages

  const showDivider = filteredEcho.length > 0 && filteredChar.length > 0

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex shrink-0">
        {filledCharacters.map((character) => {
          const isFocused = character.id === focusedId
          const hex = elementHex(character.element)
          return (
            <button
              key={character.id}
              className={[
                "h-11 flex-1 flex flex-col items-center justify-center px-3 text-center border-b-2 transition-colors",
                isFocused ? "bg-card" : "border-transparent",
              ].join(" ")}
              style={isFocused ? { borderColor: hex } : undefined}
              onClick={() => onFocus(character.id)}
            >
              <div
                className={[
                  "text-sm truncate leading-none",
                  isFocused ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {character.name}
              </div>
              <div
                className="text-micro font-mono uppercase tracking-[1px] leading-none mt-1"
                style={{ color: hex }}
              >
                {character.element}
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex px-2 py-1.5 border-y border-border shrink-0">
        <button
          className={[
            "px-2 py-0.5 rounded text-xs font-mono border transition-colors",
            filterKey === null
              ? "bg-card border-border text-foreground"
              : "bg-transparent border-transparent text-muted-foreground",
          ].join(" ")}
          onClick={() => setFilterKey(null)}
        >
          all
        </button>
        <div className="flex flex-wrap gap-1 pl-2">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              className={[
                "px-2 py-0.5 rounded text-xs font-mono border transition-colors",
                filterKey === chip.key
                  ? "bg-card border-border text-foreground"
                  : "bg-transparent border-transparent text-muted-foreground",
              ].join(" ")}
              onClick={() =>
                setFilterKey(filterKey === chip.key ? null : chip.key)
              }
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredEcho.map((stage) => (
          <StageRow key={stage.key} stage={stage} onStageClick={onStageClick} />
        ))}
        {showDivider && (
          <div
            data-testid="echo-character-divider"
            className="border-b border-border my-1 mx-2"
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
  const durationSec = formatFrames(stage.durationFrames)
  return (
    <button
      className="w-full flex items-center px-2 py-2 text-left hover:bg-gray-800 border-gray-700/50 transition-colors"
      onClick={() => onStageClick(stage.clickPayload)}
    >
      <span className="w-12 pr-2 text-right font-mono text-xs text-gray-500">
        {stage.typeLabel}
      </span>
      <span className="flex-1 text-sm text-gray-200">{stage.label}</span>
      <span className="font-mono text-label text-gray-500 ml-2">
        {durationSec}
      </span>
    </button>
  )
}
