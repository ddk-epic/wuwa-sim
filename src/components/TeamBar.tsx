import type { Character } from '#/types/character'
import type { Slots } from '#/types/loadout'

interface TeamBarProps {
  slots: Slots
  characters: Character[]
  onEditTeam: () => void
}

export function TeamBar({ slots, characters, onEditTeam }: TeamBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 shrink-0">
      {slots.map((charId, i) => {
        const character =
          charId !== null
            ? (characters.find((c) => c.id === charId) ?? null)
            : null
        return (
          <div
            key={i}
            className="px-3 py-1 rounded bg-gray-800 border border-gray-700 text-sm text-gray-300"
          >
            {character !== null ? character.name : '—'}
          </div>
        )
      })}
      <button
        className="ml-auto px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm text-white transition-colors"
        onClick={onEditTeam}
      >
        Edit Team
      </button>
    </div>
  )
}
