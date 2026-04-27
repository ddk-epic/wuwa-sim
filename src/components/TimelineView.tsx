import type { TimelineEntry } from '#/types/timeline'
import type { Character } from '#/types/character'
import { accumulateTime, computeDamage } from '#/lib/timeline'

interface TimelineViewProps {
  entries: TimelineEntry[]
  characters: Character[]
  onRemove: (id: string) => void
}

export function TimelineView({
  entries,
  characters,
  onRemove,
}: TimelineViewProps) {
  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Select a stage from the sidebar to build your rotation
      </div>
    )
  }

  const times = accumulateTime(entries)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <table className="w-full text-sm text-left">
        <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
          <tr className="text-gray-400 text-xs uppercase">
            <th className="px-3 py-2 w-8">#</th>
            <th className="px-3 py-2">Character</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Damage</th>
            <th className="px-3 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const char = characters.find((c) => c.id === entry.characterId)
            const maxAtk = char?.stats.max.atk ?? 0
            const damage =
              entry.multiplier > 0
                ? computeDamage(entry.multiplier, maxAtk)
                : null
            return (
              <tr
                key={entry.id}
                className="border-t border-gray-700 hover:bg-gray-800/50"
              >
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2 text-white">{char?.name ?? '—'}</td>
                <td className="px-3 py-2 text-gray-300">{entry.attackType}</td>
                <td className="px-3 py-2 text-gray-200">{entry.skillName}</td>
                <td className="px-3 py-2 text-gray-300">
                  {times[i].toFixed(2)}s
                </td>
                <td className="px-3 py-2 text-yellow-400">
                  {damage !== null ? damage.toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onRemove(entry.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
