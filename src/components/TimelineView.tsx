import { useState } from "react"
import type { TimelineEntry } from "#/types/timeline"
import type { VariantKind } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineSummary } from "#/lib/timeline-summary"
import { getCharacterById, getEchoById } from "#/lib/catalog"
import { resolveActionTime } from "#/lib/resolve-action-time"
import type { ActionTimeStage } from "#/lib/resolve-action-time"
import { validateTimeline } from "#/lib/validate-timeline"

const VARIANT_ORDER: (VariantKind | undefined)[] = [
  undefined,
  "cancel",
  "instantCancel",
]

const VARIANT_LABEL: Record<VariantKind, string> = {
  cancel: "(Cancel)",
  instantCancel: "(Instant Cancel)",
}

function nextVariant(
  current: VariantKind | undefined,
  stage: ActionTimeStage,
): VariantKind | undefined {
  const defined = VARIANT_ORDER.filter(
    (v) => v === undefined || stage.variants?.[v] !== undefined,
  )
  const idx = defined.indexOf(current)
  return defined[(idx + 1) % defined.length]
}

interface TimelineViewProps {
  entries: TimelineEntry[]
  summary: TimelineSummary
  slots: Slots
  loadouts: SlotLoadout[]
  reactionDelay: number
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

function findStageForRow(
  entry: TimelineEntry,
  slots: Slots,
  loadouts: SlotLoadout[],
): ActionTimeStage | null {
  if (entry.skillType === "Echo Skill") {
    const slotIndex = slots.findIndex((id) => id === entry.characterId)
    const echoId = slotIndex >= 0 ? (loadouts[slotIndex]?.echoId ?? null) : null
    const echo = echoId !== null ? getEchoById(echoId) : null
    if (!echo) return null
    const label = (name: string, newName?: string) =>
      !newName
        ? name
        : newName.startsWith("(")
          ? `${name} ${newName}`
          : `${name} · ${newName}`
    return (
      echo.skill.stages.find(
        (s) => label(echo.name, s.newName) === entry.skillName,
      ) ?? null
    )
  }
  const character = getCharacterById(entry.characterId)
  if (!character) return null
  const label = (name: string, newName?: string) =>
    !newName
      ? name
      : newName.startsWith("(")
        ? `${name} ${newName}`
        : `${name} · ${newName}`
  for (const skill of character.skills) {
    if (skill.type !== entry.skillType) continue
    const stage = skill.stages.find(
      (s) => label(skill.name, s.newName) === entry.skillName,
    )
    if (stage) return stage
  }
  return null
}

export function TimelineView({
  entries,
  summary,
  slots,
  loadouts,
  reactionDelay,
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
            const stage = findStageForRow(entry, slots, loadouts)
            const stageWithVariants =
              stage !== null &&
              stage.variants !== undefined &&
              Object.keys(stage.variants).length > 0
                ? stage
                : null

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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={isInvalid ? "text-red-400" : ""}
                      title={isInvalid ? "red-marker" : undefined}
                    >
                      {entry.skillName}
                      {entry.variantKind && (
                        <span className="ml-1 text-xs text-blue-400">
                          {VARIANT_LABEL[entry.variantKind]}
                        </span>
                      )}
                    </span>
                    {stageWithVariants && (
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          onUpdateEntry(entry.id, {
                            variantKind: nextVariant(
                              entry.variantKind,
                              stageWithVariants,
                            ),
                          })
                        }}
                        className="text-xs px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors shrink-0"
                        title="Cycle variant: Full → Cancel → Instant Cancel"
                      >
                        {entry.variantKind === undefined
                          ? "Full"
                          : entry.variantKind === "cancel"
                            ? "Cancel"
                            : "IC"}
                      </button>
                    )}
                    {showMessage && errors.length > 0 && (
                      <span className="text-xs text-red-400">
                        {errors[0].message}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-300">
                  {(() => {
                    const frames = stage
                      ? resolveActionTime(
                          stage,
                          entry.variantKind,
                          reactionDelay,
                        )
                      : 0
                    return (
                      <>
                        <span className="text-sm">{frames}</span>
                        <span className="ml-1 text-xs text-gray-500">
                          {row.time.toFixed(2)}s
                        </span>
                      </>
                    )
                  })()}
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
