import { useState, useRef, useEffect } from "react"
import {
  LockClosedIcon,
  LockOpen1Icon,
  CopyIcon,
  TrashIcon,
} from "@radix-ui/react-icons"
import type { TimelineEntry, TimelineNode } from "#/types/timeline"
import { flattenNodes } from "#/types/timeline"
import type { VariantKind } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineSummary } from "#/lib/timeline-summary"
import type { SimulationLogEntry } from "#/types/simulation-log"
import { ELEMENT_HEX } from "#/data/elements"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { getCharacterById } from "#/lib/catalog"
import { findStageByEntry, resolveStageExecution } from "#/lib/stage"
import type { ActionTimeStage } from "#/lib/stage"
import { validateTimeline } from "#/lib/validate-timeline"
import { ConfirmModal } from "./ConfirmModal"

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

function variantLabel(v: VariantKind | undefined): string {
  if (v === "cancel") return "CNCL"
  if (v === "instantCancel") return "INST"
  return "FULL"
}

interface TimelineViewProps {
  nodes: TimelineNode[]
  summary: TimelineSummary
  slots: Slots
  loadouts: SlotLoadout[]
  reactionDelay: number
  renamingGroupId: string | null
  log: SimulationLogEntry[]
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
  onReorderNodes: (fromId: string, toId: string) => void
  onUpdateEntry: (id: string, patch: Partial<TimelineEntry>) => void
  onGroupLabelCommit: (groupId: string, label: string) => void
  onGroupLabelRenameEnd: () => void
  onToggleGroupLock: (groupId: string) => void
  onStartRename: (groupId: string) => void
  onDuplicateGroup: (groupId: string) => void
  onDeleteGroup: (groupId: string) => void
  onReorderGroupEntries: (groupId: string, fromId: string, toId: string) => void
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
  renamingGroupId,
  log,
  onRemove,
  onReorder,
  onReorderNodes,
  onUpdateEntry,
  onGroupLabelCommit,
  onGroupLabelRenameEnd,
  onToggleGroupLock,
  onStartRename,
  onDuplicateGroup,
  onDeleteGroup,
  onReorderGroupEntries,
}: TimelineViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [draggingType, setDraggingType] = useState<"entry" | "group" | null>(
    null,
  )
  const [dragSrcCtx, setDragSrcCtx] = useState<{
    groupId: string | null
    locked: boolean
  } | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)

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

  const actionEvents = log.filter((e) => e.kind === "action")
  const logMatches = actionEvents.length === entries.length

  // Build a flat render list: group headers interleaved with entry rows
  type RenderItem =
    | {
        type: "groupHeader"
        groupId: string
        label: string
        locked: boolean
        entryCount: number
      }
    | {
        type: "entry"
        entry: TimelineEntry
        flatIndex: number
        inGroup: boolean
        groupId: string | null
        groupLocked: boolean
      }

  const renderItems: RenderItem[] = []
  let flatIndex = 0

  for (const node of nodes) {
    if (node.kind === "group") {
      renderItems.push({
        type: "groupHeader",
        groupId: node.id,
        label: node.label,
        locked: node.locked,
        entryCount: node.entries.length,
      })
      for (const entry of node.entries) {
        renderItems.push({
          type: "entry",
          entry,
          flatIndex: flatIndex++,
          inGroup: true,
          groupId: node.id,
          groupLocked: node.locked,
        })
      }
    } else {
      const { id, characterId, stageId, variantKind } = node
      renderItems.push({
        type: "entry",
        entry: { id, characterId, stageId, variantKind },
        flatIndex: flatIndex++,
        inGroup: false,
        groupId: null,
        groupLocked: false,
      })
    }
  }

  function isDropAllowed(
    targetGroupId: string | null,
    targetGroupLocked: boolean,
  ): boolean {
    if (!dragSrcCtx) return true
    const { groupId: srcGroupId, locked: srcLocked } = dragSrcCtx
    if (srcLocked) return targetGroupId === srcGroupId
    if (targetGroupLocked && targetGroupId !== srcGroupId) return false
    return true
  }

  function renderEntryRow(
    entry: TimelineEntry,
    i: number,
    inGroup: boolean,
    groupId: string | null,
    groupLocked: boolean,
  ) {
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
    const rejectsGroupDrop = inGroup && draggingType === "group"
    const allowed = isDropAllowed(groupId, groupLocked)

    const charElement = char?.element ?? ""
    const charHex = ELEMENT_HEX[charElement] ?? "#888"
    const elementLetter = charElement[0] ?? "?"

    const duration = resolved
      ? resolveStageExecution(resolved.stage, entry.variantKind, reactionDelay)
          .duration / 60
      : 0

    const conVal =
      logMatches && actionEvents[i]?.kind === "action"
        ? actionEvents[i].cumulativeConcerto
        : null
    const resVal =
      logMatches && actionEvents[i]?.kind === "action"
        ? actionEvents[i].cumulativeEnergy
        : null

    const prevEntry = i > 0 ? entries[i - 1] : null
    const charSwitched =
      prevEntry === null || prevEntry.characterId !== entry.characterId
    const rowBorderStyle = charSwitched
      ? { borderTopColor: `${charHex}33` }
      : undefined

    function handleDrop() {
      if (draggedId === null || draggedId === entry.id) return
      if (inGroup && groupId && dragSrcCtx?.groupId === groupId) {
        onReorderGroupEntries(groupId, draggedId, entry.id)
      } else if (!inGroup && dragSrcCtx?.groupId === null) {
        onReorder(draggedId, entry.id)
      } else if (!inGroup && draggingType === "group") {
        onReorderNodes(draggedId, entry.id)
      }
    }

    return (
      <tr
        key={entry.id}
        draggable
        onDragStart={(ev) => {
          ev.dataTransfer.effectAllowed = "move"
          setDraggedId(entry.id)
          setDraggingType("entry")
          setDragSrcCtx({ groupId, locked: groupLocked })
        }}
        onDragOver={(ev) => {
          if (rejectsGroupDrop || !allowed) return
          ev.preventDefault()
          ev.dataTransfer.dropEffect = "move"
          if (entry.id !== draggedId) setDropTargetId(entry.id)
        }}
        onDrop={(ev) => {
          if (rejectsGroupDrop || !allowed) return
          ev.preventDefault()
          handleDrop()
          setDraggedId(null)
          setDraggingType(null)
          setDragSrcCtx(null)
          setDropTargetId(null)
        }}
        onDragEnd={() => {
          setDraggedId(null)
          setDraggingType(null)
          setDragSrcCtx(null)
          setDropTargetId(null)
        }}
        className={[
          "border-t cursor-grab",
          charSwitched ? "" : "border-gray-700",
          isDragging ? "opacity-40" : "hover:bg-gray-800/50",
          isDropTarget ? "border-t-blue-500 border-t-2" : "",
          isInvalid ? "bg-red-950/30" : "",
          inGroup && groupLocked ? "border-l-2 border-l-gray-600/60" : "",
        ].join(" ")}
        style={rowBorderStyle}
      >
        {/* # */}
        <td className="px-2 py-2 text-gray-400 font-mono text-xs w-8">
          {i + 1}
        </td>
        {/* time */}
        <td className="px-2 py-2 text-right font-mono text-xs text-gray-300">
          {row.time.toFixed(2)}s
        </td>
        {/* char */}
        <td className="px-2 py-2 text-white">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm text-[10px] font-bold text-gray-900 shrink-0"
              style={{ backgroundColor: charHex }}
            >
              {elementLetter}
            </span>
            <span className="text-sm">{char?.name ?? "—"}</span>
          </div>
        </td>
        {/* type */}
        <td className="px-2 py-2">
          {resolved && (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase"
              style={{
                background: `${charHex}15`,
                border: `1px solid ${charHex}33`,
                color: charHex,
              }}
            >
              {STAGE_TYPE_LABELS[resolved.skillType] ?? resolved.skillType}
            </span>
          )}
        </td>
        {/* skill */}
        <td className="px-2 py-2 text-gray-200">
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
                className="text-[9px] px-1 py-0.5 rounded font-mono shrink-0"
                style={{
                  background: `${charHex}15`,
                  border: `1px solid ${charHex}55`,
                  color: charHex,
                }}
                title="Full / Cancel / Instant Cancel"
              >
                {variantLabel(entry.variantKind)}
              </button>
            )}
            {showMessage && errors.length > 0 && (
              <span className="text-xs text-red-400">{errors[0].message}</span>
            )}
          </div>
        </td>
        {/* duration */}
        <td className="px-2 py-2 text-right font-mono text-xs text-gray-300">
          {duration.toFixed(2)}s
        </td>
        {/* con */}
        <td className="px-2 py-2 text-right font-mono text-xs">
          {conVal === null ? (
            <span className="text-gray-600">—</span>
          ) : conVal >= 100 ? (
            <span className="font-bold" style={{ color: "#f5cf4d" }}>
              {conVal}
            </span>
          ) : conVal === 0 ? (
            <span className="text-gray-600">{conVal}</span>
          ) : (
            <span className="text-gray-300">{conVal}</span>
          )}
        </td>
        {/* res */}
        <td className="px-2 py-2 text-right font-mono text-xs">
          {resVal === null ? (
            <span className="text-gray-600">—</span>
          ) : resVal >= 100 ? (
            <span className="font-bold" style={{ color: "#9b6cf0" }}>
              {resVal}
            </span>
          ) : resVal === 0 ? (
            <span className="text-gray-600">{resVal}</span>
          ) : (
            <span className="text-gray-300">{resVal}</span>
          )}
        </td>
        {/* dmg */}
        <td className="px-2 py-2 text-right font-mono text-xs">
          {row.damage !== null ? (
            <span className="text-yellow-400">
              {row.damage.toLocaleString()}
            </span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
        </td>
        {/* actions */}
        <td className="px-2 py-2">
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
            <th className="px-2 py-2 w-8">#</th>
            <th className="px-2 py-2 text-right">time</th>
            <th className="px-2 py-2">char</th>
            <th className="px-2 py-2">type</th>
            <th className="px-2 py-2">skill</th>
            <th className="px-2 py-2 text-right">dur</th>
            <th className="px-2 py-2 text-right">con</th>
            <th className="px-2 py-2 text-right">res</th>
            <th className="px-2 py-2 text-right">dmg</th>
            <th className="px-2 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {renderItems.map((item) => {
            if (item.type === "groupHeader") {
              const isOpen = !item.locked
              const isRenaming = renamingGroupId === item.groupId
              const isGroupDropTarget = dropTargetId === `group:${item.groupId}`
              const isDraggingThisGroup = draggedId === item.groupId
              return (
                <tr
                  key={`group-${item.groupId}`}
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.effectAllowed = "move"
                    setDraggedId(item.groupId)
                    setDraggingType("group")
                  }}
                  onDragOver={(ev) => {
                    if (draggingType === "group") {
                      ev.preventDefault()
                      ev.dataTransfer.dropEffect = "move"
                      if (item.groupId !== draggedId)
                        setDropTargetId(`group:${item.groupId}`)
                    } else if (
                      draggingType === "entry" &&
                      dragSrcCtx?.groupId === null
                    ) {
                      ev.preventDefault()
                      ev.dataTransfer.dropEffect = "move"
                      setDropTargetId(`group:${item.groupId}`)
                    }
                  }}
                  onDrop={(ev) => {
                    if (draggingType === "group") {
                      ev.preventDefault()
                      if (draggedId !== null && draggedId !== item.groupId) {
                        onReorderNodes(draggedId, item.groupId)
                      }
                      setDraggedId(null)
                      setDraggingType(null)
                      setDropTargetId(null)
                    } else if (
                      draggingType === "entry" &&
                      dragSrcCtx?.groupId === null &&
                      draggedId !== null
                    ) {
                      ev.preventDefault()
                      onReorderNodes(draggedId, item.groupId)
                      setDraggedId(null)
                      setDraggingType(null)
                      setDragSrcCtx(null)
                      setDropTargetId(null)
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedId(null)
                    setDraggingType(null)
                    setDropTargetId(null)
                  }}
                  className={[
                    "border-t border-gray-600 bg-gray-900/60 cursor-grab",
                    isDraggingThisGroup ? "opacity-40" : "",
                    isGroupDropTarget ? "border-t-blue-500 border-t-2" : "",
                  ].join(" ")}
                >
                  <td className="w-8 px-2 py-1.5 text-gray-500 text-xs">—</td>
                  <td
                    colSpan={9}
                    className="px-2 py-1.5 text-gray-400 text-xs font-medium"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        {isOpen || isRenaming ? (
                          <GroupLabelInput
                            groupId={item.groupId}
                            initialLabel={item.label}
                            autoFocus={isRenaming}
                            onCommit={(gid, label) => {
                              onGroupLabelCommit(gid, label)
                              onGroupLabelRenameEnd()
                            }}
                          />
                        ) : (
                          <span
                            onClick={() => onStartRename(item.groupId)}
                            className="cursor-text hover:text-white transition-colors text-sm inline-block w-40 border-b border-transparent"
                            title="Click to rename"
                          >
                            {item.label || (
                              <span className="italic text-gray-600">
                                unnamed
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onToggleGroupLock(item.groupId)}
                          className={[
                            "p-0.5 transition-colors",
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
                          {isOpen ? <LockOpen1Icon /> : <LockClosedIcon />}
                        </button>
                        <button
                          onClick={() => onDuplicateGroup(item.groupId)}
                          className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
                          title="Duplicate group"
                          aria-label="Duplicate group"
                        >
                          <CopyIcon />
                        </button>
                        <button
                          onClick={() => {
                            if (item.entryCount >= 2) {
                              setDeletingGroupId(item.groupId)
                            } else {
                              onDeleteGroup(item.groupId)
                            }
                          }}
                          className="p-0.5 text-gray-500 hover:text-red-400 transition-colors"
                          title="Delete group and contents"
                          aria-label="Delete group and contents"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            }
            return renderEntryRow(
              item.entry,
              item.flatIndex,
              item.inGroup,
              item.groupId,
              item.groupLocked,
            )
          })}
        </tbody>
      </table>
      {deletingGroupId !== null && (
        <ConfirmModal
          message="Delete this group and all its entries? This cannot be undone."
          onConfirm={() => {
            onDeleteGroup(deletingGroupId)
            setDeletingGroupId(null)
          }}
          onCancel={() => setDeletingGroupId(null)}
        />
      )}
    </div>
  )
}
