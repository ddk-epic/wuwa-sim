import type { EnrichedCharacter } from "#/types/character"
import {
  elementHex,
  portraitSrc,
  nameInitial,
} from "#/components/ui/character-visual"
import { listCharacters } from "#/lib/loadout/catalog"
import { useAtomValue, useSetAtom } from "jotai"
import { slotsAtom, focusedIdAtom, toggleCharacterAtom } from "#/state/team"
import { CharacterPortrait } from "#/components/ui/CharacterPortrait"

const RARITY_HEX: Record<string, string> = {
  SSR: "var(--color-rarity-ssr)",
  SR: "var(--color-rarity-sr)",
}

export function CharacterGrid() {
  const slots = useAtomValue(slotsAtom)
  const focusedId = useAtomValue(focusedIdAtom)
  const toggleCharacter = useSetAtom(toggleCharacterAtom)
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
  character: EnrichedCharacter
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
  const hex = elementHex(character.element)
  const rarityHex =
    RARITY_HEX[character.rarity] ?? "var(--color-rarity-fallback)"

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
      <CharacterPortrait
        src={portraitSrc(character.name)}
        alt={character.name}
        initial={nameInitial(character.name)}
        hex={hex}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center 15%" }}
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
