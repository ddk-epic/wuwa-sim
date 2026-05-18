import { useState, useRef, useEffect } from "react"
import {
  LockClosedIcon,
  LockOpen1Icon,
  CopyIcon,
  TrashIcon,
  ChevronRightIcon,
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

function getDistinctCharsBySlot(entries: TimelineEntry[], slots: Slots) {
  const seen = new Set<number>()
  const charIds: number[] = []
  for (const e of entries) {
    if (!seen.has(e.characterId)) {
      seen.add(e.characterId)
      charIds.push(e.characterId)
    }
  }
  charIds.sort((a, b) => {
    const ia = slots.indexOf(a)
    const ib = slots.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
  return charIds
}

function buildGroupGradient(
  groupEntries: TimelineEntry[],
  slots: Slots,
): string {
  const charIds = getDistinctCharsBySlot(groupEntries, slots)
  const hexes = charIds.map((id) => {
    const char = getCharacterById(id)
    return ELEMENT_HEX[char?.element ?? ""] ?? "#888"
  })
  if (hexes.length === 0) return "transparent"
  if (hexes.length === 1) return `${hexes[0]}3a`
  return `linear-gradient(to right, ${hexes.map((h) => `${h}3a`).join(", ")})`
}

function getDominantHex(groupEntries: TimelineEntry[]): string {
  const counts = new Map<number, number>()
  for (const e of groupEntries) {
    counts.set(e.characterId, (counts.get(e.characterId) ?? 0) + 1)
  }
  let maxCount = 0
  let dominantId: number | null = groupEntries[0]?.characterId ?? null
  for (const [id, count] of counts) {
    if (count > maxCount) {
      maxCount = count
      dominantId = id
    }
  }
  if (dominantId === null) return "#888"
  const char = getCharacterById(dominantId)
  return ELEMENT_HEX[char?.element ?? ""] ?? "#888"
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
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    () =>
      new Set(
        nodes
          .filter(
            (n): n is Extract<TimelineNode, { kind: "group" }> =>
              n.kind === "group",
          )
          .map((n) => n.id),
      ),
  )

  useEffect(() => {
    setExpandedGroupIds((prev) => {
      const groupIds = new Set(
        nodes
          .filter(
            (n): n is Extract<TimelineNode, { kind: "group" }> =>
              n.kind === "group",
          )
          .map((n) => n.id),
      )
      const next = new Set<string>()
      // keep existing state for known groups, add new groups as expanded
      for (const id of groupIds) {
        if (prev.has(id)) next.add(id)
        else next.add(id) // new group → expanded
      }
      if (next.size === prev.size && [...next].every((id) => prev.has(id)))
        return prev
      return next
    })
  }, [nodes])

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

  type RenderItem =
    | {
        type: "groupHeader"
        groupId: string
        label: string
        locked: boolean
        entryCount: number
        groupEntries: TimelineEntry[]
        startFlatIndex: number
      }
    | {
        type: "entry"
        entry: TimelineEntry
        flatIndex: number
        inGroup: boolean
        groupId: string | null
        groupLocked: boolean
        isLastInGroup: boolean
      }

  const renderItems: RenderItem[] = []
  let flatIndex = 0

  for (const node of nodes) {
    if (node.kind === "group") {
      const isExpanded = expandedGroupIds.has(node.id)
      const startFlatIndex = flatIndex
      renderItems.push({
        type: "groupHeader",
        groupId: node.id,
        label: node.label,
        locked: node.locked,
        entryCount: node.entries.length,
        groupEntries: node.entries as TimelineEntry[],
        startFlatIndex,
      })
      if (isExpanded) {
        node.entries.forEach((entry, entryIdx) => {
          renderItems.push({
            type: "entry",
            entry: entry as TimelineEntry,
            flatIndex: flatIndex++,
            inGroup: true,
            groupId: node.id,
            groupLocked: node.locked,
            isLastInGroup: entryIdx === node.entries.length - 1,
          })
        })
      } else {
        // Advance flatIndex without rendering
        flatIndex += node.entries.length
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
        isLastInGroup: false,
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

  function renderPoolValue(val: number | null, activeColor: string) {
    if (val === null) return <span style={{ color: "#42475a" }}>—</span>
    if (val === 0) return <span style={{ color: "#42475a" }}>0</span>
    if (val >= 100)
      return (
        <span className="font-bold" style={{ color: activeColor }}>
          {val}
        </span>
      )
    return (
      <span className="font-medium" style={{ color: activeColor }}>
        {val}
      </span>
    )
  }

  function renderEntryRow(
    entry: TimelineEntry,
    i: number,
    inGroup: boolean,
    groupId: string | null,
    groupLocked: boolean,
    isLastInGroup: boolean,
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
        ].join(" ")}
        style={rowBorderStyle}
      >
        {/* # with branch glyph */}
        <td className="px-2 py-2 font-mono text-xs w-8">
          {inGroup ? (
            <span className="text-gray-600 font-light text-sm mr-0.5">
              {isLastInGroup ? "└" : "├"}
            </span>
          ) : null}
          <span className="text-gray-400">{i + 1}</span>
        </td>
        {/* time */}
        <td className="px-2 py-2 text-right font-mono text-xs text-gray-300">
          {row.time.toFixed(2)}s
        </td>
        {/* char */}
        <td className="px-2 py-2 text-white">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm text-[9px] font-black text-gray-900 shrink-0"
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
        <td className="px-2 py-2 text-right font-mono">
          {renderPoolValue(conVal, "#f5cf4d")}
        </td>
        {/* res */}
        <td className="px-2 py-2 text-right font-mono">
          {renderPoolValue(resVal, "#9b6cf0")}
        </td>
        {/* dmg */}
        <td className="px-2 py-2 text-right font-mono">
          {row.damage !== null ? (
            <span className="font-semibold text-yellow-400">
              {row.damage.toLocaleString()}
            </span>
          ) : (
            <span className="font-semibold text-gray-600">—</span>
          )}
        </td>
        {/* actions */}
        <td className="px-2 py-2">
          <div className="flex justify-end">
            <button
              onClick={() => onRemove(entry.id)}
              className="text-gray-500 hover:text-red-400 transition-colors"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        </td>
      </tr>
    )
  }

  function renderGroupHeader(
    item: Extract<RenderItem, { type: "groupHeader" }>,
  ) {
    const isExpanded = expandedGroupIds.has(item.groupId)
    const isRenaming = renamingGroupId === item.groupId
    const isGroupDropTarget = dropTargetId === `group:${item.groupId}`
    const isDraggingThisGroup = draggedId === item.groupId
    const dominantHex = getDominantHex(item.groupEntries)
    const gradient = buildGroupGradient(item.groupEntries, slots)
    const distinctCharIds = getDistinctCharsBySlot(item.groupEntries, slots)
    const startFlatIndex = item.startFlatIndex
    const lastFlatIndex = startFlatIndex + item.entryCount - 1

    // Aggregate values
    const totalDurationSec = item.groupEntries.reduce((sum, entry) => {
      const resolved = findStageByEntry(entry, slots, loadouts)
      if (!resolved) return sum
      return (
        sum +
        resolveStageExecution(resolved.stage, entry.variantKind, reactionDelay)
          .duration /
          60
      )
    }, 0)

    const firstRowTime =
      item.entryCount > 0
        ? (summary.rows[startFlatIndex]?.time ?? 0).toFixed(2)
        : "0.00"

    const lastConVal =
      isExpanded || item.entryCount === 0 || !logMatches
        ? null
        : actionEvents[lastFlatIndex]?.kind === "action"
          ? actionEvents[lastFlatIndex].cumulativeConcerto
          : null

    const lastResVal =
      isExpanded || item.entryCount === 0 || !logMatches
        ? null
        : actionEvents[lastFlatIndex]?.kind === "action"
          ? actionEvents[lastFlatIndex].cumulativeEnergy
          : null

    let totalDmg = 0
    let hasDmg = false
    for (let i = startFlatIndex; i <= lastFlatIndex; i++) {
      const d = summary.rows[i]?.damage
      if (d !== null && d !== undefined) {
        totalDmg += d
        hasDmg = true
      }
    }

    function handleToggleExpand(e: React.MouseEvent) {
      e.stopPropagation()
      setExpandedGroupIds((prev) => {
        const next = new Set(prev)
        if (next.has(item.groupId)) next.delete(item.groupId)
        else next.add(item.groupId)
        return next
      })
    }

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
          } else if (draggingType === "entry" && dragSrcCtx?.groupId === null) {
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
        onClick={handleToggleExpand}
        className={[
          "border-t border-gray-600 cursor-pointer",
          isDraggingThisGroup ? "opacity-40" : "",
          isGroupDropTarget ? "border-t-blue-500 border-t-2" : "",
        ].join(" ")}
        style={{ background: gradient }}
      >
        {/* # — chevron */}
        <td className="w-8 px-2 py-1.5" onClick={handleToggleExpand}>
          <ChevronRightIcon
            style={{
              color: dominantHex,
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          />
        </td>
        {/* time */}
        <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-300">
          {firstRowTime}s
        </td>
        {/* char — stacked avatars */}
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-1">
            <div className="flex items-center">
              {distinctCharIds.map((charId, idx) => {
                const char = getCharacterById(charId)
                const hex = ELEMENT_HEX[char?.element ?? ""] ?? "#888"
                const name = char?.name.toLowerCase() ?? ""
                return (
                  <img
                    key={charId}
                    src={`/${name}.png`}
                    alt={char?.name ?? ""}
                    className="w-5 h-5 rounded-full object-cover"
                    style={{
                      marginLeft: idx > 0 ? "-6px" : undefined,
                      outline: `1.5px solid ${hex}`,
                      outlineOffset: "0px",
                    }}
                  />
                )
              })}
            </div>
            {distinctCharIds.length > 1 && (
              <span className="text-gray-500 font-mono text-[10px] ml-1">
                × {distinctCharIds.length}
              </span>
            )}
          </div>
        </td>
        {/* type — GROUP pill */}
        <td className="px-2 py-1.5">
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase"
            style={{
              background: `${dominantHex}15`,
              border: `1px solid ${dominantHex}33`,
              color: dominantHex,
            }}
          >
            GROUP
          </span>
        </td>
        {/* skill — group name + action count */}
        <td
          className="px-2 py-1.5 text-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            {!item.locked || isRenaming ? (
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
                onClick={(e) => {
                  e.stopPropagation()
                  onStartRename(item.groupId)
                }}
                className="cursor-text hover:text-white transition-colors text-sm font-bold inline-block border-b border-transparent"
                title="Click to rename"
              >
                {item.label || (
                  <span className="italic text-gray-600 font-normal">
                    unnamed
                  </span>
                )}
              </span>
            )}
            <span className="text-gray-500 text-xs font-mono">
              {item.entryCount} actions
            </span>
          </div>
        </td>
        {/* dur — sum */}
        <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-300">
          {totalDurationSec.toFixed(2)}s
        </td>
        {/* con */}
        <td className="px-2 py-1.5 text-right font-mono text-xs">
          {renderPoolValue(lastConVal, 100, "#f5cf4d")}
        </td>
        {/* res */}
        <td className="px-2 py-1.5 text-right font-mono text-xs">
          {renderPoolValue(lastResVal, 100, "#9b6cf0")}
        </td>
        {/* dmg */}
        <td className="px-2 py-1.5 text-right font-mono text-xs">
          {hasDmg ? (
            isExpanded ? (
              <span className="text-gray-600">{totalDmg.toLocaleString()}</span>
            ) : (
              <span className="font-bold text-yellow-400">
                {totalDmg.toLocaleString()}
              </span>
            )
          ) : (
            <span className="text-gray-600">—</span>
          )}
        </td>
        {/* actions */}
        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleGroupLock(item.groupId)
              }}
              className={[
                "p-0.5 transition-colors",
                !item.locked
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-gray-600 hover:text-gray-400",
              ].join(" ")}
              title={
                !item.locked ? "Open — click to lock" : "Locked — click to open"
              }
              aria-label={!item.locked ? "Lock group" : "Unlock group"}
            >
              {!item.locked ? <LockOpen1Icon /> : <LockClosedIcon />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDuplicateGroup(item.groupId)
              }}
              className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
              title="Duplicate group"
              aria-label="Duplicate group"
            >
              <CopyIcon />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
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
        </td>
      </tr>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <table className="w-full text-[12px] text-left">
        <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
          <tr className="text-gray-400 text-[9px] tracking-[1px] uppercase">
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
              return renderGroupHeader(item)
            }
            return renderEntryRow(
              item.entry,
              item.flatIndex,
              item.inGroup,
              item.groupId,
              item.groupLocked,
              item.isLastInGroup,
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
