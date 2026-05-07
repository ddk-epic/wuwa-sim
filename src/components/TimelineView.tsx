import { useState } from "react"
import type { TimelineEntry } from "#/types/timeline"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineSummary } from "#/lib/timeline-summary"
import { getCharacterById } from "#/lib/catalog"
import { validateTimeline } from "#/lib/validate-timeline"

interface TimelineViewProps {
  entries: TimelineEntry[]
  summary: TimelineSummary
  slots: Slots
  loadouts: SlotLoadout[]
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
  onUpdateEntry: (id: string, patch: Partial<TimelineEntry>) => void
}

function reorderPreview(
  entries: TimelineEntry[],
  draggedId: string,
  dropTargetId: string,
): TimelineEntry[] {
  const fromIndex = entries.findIndex((e) => e.id === draggedId)
  const toIndex = entries.findIndex((e) => e.id === dropTargetId)
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex)
    return entries
  const next = [...entries]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function TimelineView({
  entries,
  summary,
  slots,
  loadouts,
  onRemove,
  onReorder,
  onUpdateEntry,
}: TimelineViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Select a stage from the sidebar to build your rotation
      </div>
    )
  }

  const displayEntries =
    draggedId !== null && dropTargetId !== null
      ? reorderPreview(entries, draggedId, dropTargetId)
      : entries

  const validation = validateTimeline(displayEntries, slots, loadouts)

  const rowsWithMessages = displayEntries.reduce<number[]>((acc, e, i) => {
    if ((validation.rowErrors.get(e.id)?.length ?? 0) > 0) acc.push(i)
    return acc
  }, [])
  const messageIndexes = new Set(rowsWithMessages.slice(0, 2))

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
          {displayEntries.map((entry, i) => {
            const char = getCharacterById(entry.characterId)
            const origIndex = entries.findIndex((e) => e.id === entry.id)
            const row = summary.rows[origIndex] ?? { time: 0, damage: null }
            const isInvalid = validation.invalidRowIds.has(entry.id)
            const showMessage = isInvalid && messageIndexes.has(i)
            const errors = validation.rowErrors.get(entry.id) ?? []
            const isDragging = draggedId === entry.id

            return (
              <tr
                key={entry.id}
                draggable
                onDragStart={(ev) => {
                  ev.dataTransfer.effectAllowed = "move"
                  setDraggedId(entry.id)
                }}
                onDragOver={(ev) => {
                  ev.preventDefault()
                  ev.dataTransfer.dropEffect = "move"
                  if (entry.id !== draggedId) setDropTargetId(entry.id)
                }}
                onDrop={(ev) => {
                  ev.preventDefault()
                  if (draggedId !== null && draggedId !== entry.id) {
                    onReorder(draggedId, entry.id)
                  }
                  setDraggedId(null)
                  setDropTargetId(null)
                }}
                onDragEnd={() => {
                  setDraggedId(null)
                  setDropTargetId(null)
                }}
                className={[
                  "border-t border-gray-700 cursor-grab",
                  isDragging ? "opacity-40" : "hover:bg-gray-800/50",
                  isInvalid ? "bg-red-950/30" : "",
                ].join(" ")}
              >
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2 text-white">{char?.name ?? "—"}</td>
                <td className="px-3 py-2 text-gray-300">{entry.attackType}</td>
                <td className="px-3 py-2 text-gray-200">
                  <span
                    className={isInvalid ? "text-red-400" : ""}
                    title={isInvalid ? "red-marker" : undefined}
                  >
                    {entry.skillName}
                  </span>
                  {showMessage && errors.length > 0 && (
                    <span className="ml-2 text-xs text-red-400">
                      {errors[0].message}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-300">
                  <input
                    type="number"
                    min={0}
                    value={entry.actionTime}
                    onChange={(ev) =>
                      onUpdateEntry(entry.id, {
                        actionTime: Math.max(0, Number(ev.target.value)),
                      })
                    }
                    onDragStart={(ev) => ev.preventDefault()}
                    className="w-16 bg-transparent border border-gray-600 rounded px-1 text-right text-sm focus:outline-none focus:border-gray-400"
                    aria-label="Action time in frames"
                  />
                  <span className="ml-1 text-xs text-gray-500">
                    {row.time.toFixed(2)}s
                  </span>
                </td>
                <td className="px-3 py-2 text-yellow-400">
                  {row.damage !== null ? row.damage.toLocaleString() : "—"}
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
