import type { Character } from "#/types/character"
import type { Slots } from "#/types/loadout"
import { ELEMENT_CLASSES } from "#/data/elements"
import { listCharacters } from "#/lib/catalog"

interface CharacterGridProps {
  slots: Slots
  focusedId: number | null
  onToggle: (characterId: number) => void
}

export function CharacterGrid({
  slots,
  focusedId,
  onToggle,
}: CharacterGridProps) {
  const characters = listCharacters()
  const selectedCount = slots.filter((s) => s !== null).length

  return (
    <div className="grid grid-cols-4 gap-2">
      {characters.map((character) => {
        const slotIndex = slots.indexOf(character.id)
        return (
          <CharacterCard
            key={character.id}
            character={character}
            slotNumber={slotIndex !== -1 ? slotIndex + 1 : null}
            isFocused={focusedId === character.id}
            isBlocked={slotIndex === -1 && selectedCount === 3}
            onClick={() => onToggle(character.id)}
          />
        )
      })}
    </div>
  )
}

interface CharacterCardProps {
  character: Character
  slotNumber: number | null
  isFocused: boolean
  isBlocked: boolean
  onClick: () => void
}

function CharacterCard({
  character,
  slotNumber,
  isFocused,
  isBlocked,
  onClick,
}: CharacterCardProps) {
  const elementBorder =
    ELEMENT_CLASSES[character.element] ?? "border-gray-600 bg-gray-700/10"

  return (
    <div
      className={[
        "relative rounded border-2 px-2 py-1.5 transition-all select-none",
        elementBorder,
        isFocused ? "ring-2 ring-white/60" : "",
        isBlocked
          ? "opacity-40 cursor-not-allowed"
          : "cursor-pointer hover:brightness-110",
      ].join(" ")}
      onClick={isBlocked ? undefined : onClick}
    >
      {slotNumber !== null && (
        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-white text-gray-900 text-[10px] font-bold rounded-full flex items-center justify-center">
          {slotNumber}
        </div>
      )}
      <div className="text-xs font-medium text-white truncate">
        {character.name}
      </div>
    </div>
  )
}
