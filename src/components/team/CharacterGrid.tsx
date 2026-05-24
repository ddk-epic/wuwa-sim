import type { Character } from "#/types/character"
import { ELEMENT_HEX } from "#/data/elements"
import { listCharacters } from "#/lib/loadout/catalog"
import { useTeamContext } from "#/hooks/useTeamContext"
import { avatarFallbackSrc } from "#/lib/avatar-fallback"

const RARITY_HEX: Record<string, string> = {
  SSR: "#f5cf4d",
  SR: "#b67cff",
}

export function CharacterGrid() {
  const { slots, focusedId, toggleCharacter } = useTeamContext()
  const characters = listCharacters()
  const selectedCount = slots.filter((s) => s !== null).length

  return (
    <div className="grid grid-cols-3 gap-3 pr-2.5">
      {characters.map((character) => {
        const slotIndex = slots.indexOf(character.id)
        return (
          <CharacterCard
            key={character.id}
            character={character}
            slotNumber={slotIndex !== -1 ? slotIndex + 1 : null}
            isFocused={focusedId === character.id}
            isBlocked={slotIndex === -1 && selectedCount === 3}
            onClick={() => toggleCharacter(character.id)}
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
  const elementHex = ELEMENT_HEX[character.element] ?? "#888"
  const rarityHex = RARITY_HEX[character.rarity] ?? "#3a3a3a"
  const fileName = character.name.toLowerCase()

  return (
    <button
      type="button"
      onClick={isBlocked ? undefined : onClick}
      disabled={isBlocked}
      className={[
        "relative aspect-square w-full rounded-2xl overflow-hidden bg-darkest transition-all select-none border focus:outline-none",
        isBlocked ? "opacity-40" : "cursor-pointer",
        isFocused
          ? "ring-1 ring-foreground/60 ring-offset-1 ring-offset-card"
          : "",
      ].join(" ")}
      style={{ borderColor: rarityHex }}
    >
      <img
        src={`/portraits/${fileName}.png`}
        alt={character.name}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center 15%" }}
        onError={(e) => {
          e.currentTarget.onerror = null
          e.currentTarget.src = avatarFallbackSrc(
            character.name[0].toUpperCase(),
            elementHex,
          )
        }}
      />

      {slotNumber !== null && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white text-darkest font-semibold text-sm flex items-center justify-center shadow">
          {slotNumber}
        </div>
      )}

      <div
        className="absolute inset-x-0 bottom-0 px-2 pt-6 pb-1.5 text-left"
        style={{
          background:
            "linear-gradient(to top, rgba(9,10,14,0.95) 0%, rgba(9,10,14,0.5) 60%, rgba(9,10,14,0) 100%)",
        }}
      >
        <div className="text-xs text-foreground tracking-wide truncate">
          {character.name}
        </div>
      </div>
    </button>
  )
}
