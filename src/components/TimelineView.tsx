import { useState, useRef, useEffect } from "react"
import { Lock, LockOpen } from "lucide-react"
import type { TimelineEntry, TimelineNode } from "#/types/timeline"
import { flattenNodes } from "#/types/timeline"
import type { VariantKind } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineSummary } from "#/lib/timeline-summary"
import { getCharacterById } from "#/lib/catalog"
import { findStageByEntry, resolveStageExecution } from "#/lib/stage"
import type { ActionTimeStage } from "#/lib/stage"
import { validateTimeline } from "#/lib/validate-timeline"

const VARIANT_ORDER: (VariantKind | undefined)[] = [
  undefined,
  "cancel",
  "instantCancel",
]

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
  nodes: TimelineNode[]
  summary: TimelineSummary
  slots: Slots
  loadouts: SlotLoadout[]
  reactionDelay: number
  editingGroupId: string | null
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
  onUpdateEntry: (id: string, patch: Partial<TimelineEntry>) => void
  onGroupLabelCommit: (groupId: string, label: string) => void
  onToggleGroupLock: (groupId: string) => void
}

function GroupLabelInput({
  groupId,
  initialLabel,
  autoFocus,
  onCommit,
}: {
  groupId: string
  initialLabel: string
  autoFocus: boolean
  onCommit: (groupId: string, label: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  return (
    <input
      ref={ref}
      defaultValue={initialLabel}
      placeholder="Group name"
      className="bg-transparent border-b border-gray-600 text-white text-sm focus:outline-none focus:border-blue-400 w-40"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onCommit(groupId, e.currentTarget.value)
          e.currentTarget.blur()
        }
      }}
      onBlur={(e) => onCommit(groupId, e.currentTarget.value)}
    />
  )
}

export function TimelineView({
  nodes,
  summary,
  slots,
  loadouts,
  reactionDelay,
  editingGroupId,
  onRemove,
  onReorder,
  onUpdateEntry,
  onGroupLabelCommit,
  onToggleGroupLock,
}: TimelineViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const entries = flattenNodes(nodes)

  if (entries.length === 0 && nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">
        Select a skill from the sidebar to build your rotation
      </div>
    )
  }

  const validation = validateTimeline(entries, slots, loadouts)

  const rowsWithMessages = entries.reduce<number[]>((acc, e, i) => {
    if ((validation.rowErrors.get(e.id)?.length ?? 0) > 0) acc.push(i)
    return acc
  }, [])
  const messageIndexes = new Set(rowsWithMessages.slice(0, 2))

  // Build a flat render list: group headers interleaved with entry rows
  type RenderItem =
    | { type: "groupHeader"; groupId: string; label: string; locked: boolean }
    | { type: "entry"; entry: TimelineEntry; flatIndex: number }

  const renderItems: RenderItem[] = []
  let flatIndex = 0

  for (const node of nodes) {
    if (node.kind === "group") {
      renderItems.push({
        type: "groupHeader",
        groupId: node.id,
        label: node.label,
        locked: node.locked,
      })
      for (const entry of node.entries) {
        renderItems.push({ type: "entry", entry, flatIndex: flatIndex++ })
      }
    } else {
      const { id, characterId, stageId, variantKind } = node
      renderItems.push({
        type: "entry",
        entry: { id, characterId, stageId, variantKind },
        flatIndex: flatIndex++,
      })
    }
  }

  function renderEntryRow(entry: TimelineEntry, i: number) {
    const char = getCharacterById(entry.characterId)
    const row = summary.rows[i] ?? { time: 0, damage: null }
    const isInvalid = validation.invalidRowIds.has(entry.id)
    const showMessage = isInvalid && messageIndexes.has(i)
    const errors = validation.rowErrors.get(entry.id) ?? []
    const isDragging = draggedId === entry.id
    const isDropTarget = dropTargetId === entry.id
    const resolved = findStageByEntry(entry, slots, loadouts)
    const stageWithVariants =
      resolved !== null &&
      resolved.stage.variants !== undefined &&
      Object.keys(resolved.stage.variants).length > 0
        ? resolved.stage
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
          isDropTarget ? "border-t-blue-500 border-t-2" : "",
          isInvalid ? "bg-red-950/30" : "",
        ].join(" ")}
      >
        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
        <td className="px-3 py-2 text-white">{char?.name ?? "—"}</td>
        <td className="px-3 py-2 text-gray-300">
          {resolved?.skillType ?? "—"}
        </td>
        <td className="px-3 py-2 text-gray-200">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={isInvalid ? "text-red-400" : ""}
              title={isInvalid ? "red-marker" : undefined}
            >
              {resolved?.skillName ?? "—"}
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
                className="w-12 text-xs px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors shrink-0"
                title="Full / Cancel / Instant Cancel"
              >
                {entry.variantKind === undefined
                  ? "Full"
                  : entry.variantKind === "cancel"
                    ? "Cancel"
                    : "IC"}
              </button>
            )}
            {showMessage && errors.length > 0 && (
              <span className="text-xs text-red-400">{errors[0].message}</span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-gray-300">
          {(() => {
            const frames = resolved
              ? resolveStageExecution(
                  resolved.stage,
                  entry.variantKind,
                  reactionDelay,
                ).duration
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
  }

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
          {renderItems.map((item) => {
            if (item.type === "groupHeader") {
              const isOpen = !item.locked
              return (
                <tr
                  key={`group-${item.groupId}`}
                  className="border-t border-gray-600 bg-gray-900/60"
                >
                  <td className="px-3 py-1.5 text-gray-500 text-xs">—</td>
                  <td
                    colSpan={5}
                    className="px-3 py-1.5 text-gray-400 text-xs font-medium"
                  >
                    <button
                      onClick={() => onToggleGroupLock(item.groupId)}
                      className={[
                        "mr-2 align-middle transition-colors",
                        isOpen
                          ? "text-blue-400 hover:text-blue-300"
                          : "text-gray-600 hover:text-gray-400",
                      ].join(" ")}
                      title={
                        isOpen
                          ? "Open — click to lock"
                          : "Locked — click to open"
                      }
                      aria-label={isOpen ? "Lock group" : "Unlock group"}
                    >
                      {isOpen ? <LockOpen size={14} /> : <Lock size={14} />}
                    </button>
                    <GroupLabelInput
                      groupId={item.groupId}
                      initialLabel={item.label}
                      autoFocus={editingGroupId === item.groupId}
                      onCommit={onGroupLabelCommit}
                    />
                  </td>
                  <td className="px-3 py-1.5" />
                </tr>
              )
            }
            return renderEntryRow(item.entry, item.flatIndex)
          })}
        </tbody>
      </table>
    </div>
  )
}
