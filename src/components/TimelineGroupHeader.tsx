import { useEffect, useRef } from "react"
import {
  ChevronRightIcon,
  CopyIcon,
  LockIcon,
  LockOpenIcon,
  TrashIcon,
} from "lucide-react"
import type { TimelineEntry } from "#/types/timeline"
import type { Slots } from "#/types/loadout"
import type { TimelineSummary } from "#/lib/timeline-summary"
import type { SimulationLogEntry } from "#/types/simulation-log"
import { ELEMENT_HEX } from "#/data/elements"
import { getCharacterById } from "#/lib/catalog"
import { findStageByEntry, resolveStageExecution } from "#/lib/stage"
import { avatarFallbackSrc } from "#/lib/avatar-fallback"
import type { TimelineDrag } from "#/hooks/useTimelineDrag"
import { useRenamingGroup } from "#/hooks/useRenamingGroup"
import { useReactionDelay } from "#/hooks/useSettingsContext"
import { useTeamContext } from "#/hooks/useTeamContext"
import { renderPoolValue } from "./TimelineEntryRow"

export function getDistinctCharsBySlot(
  entries: TimelineEntry[],
  slots: Slots,
): number[] {
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

export function buildGroupGradient(
  groupEntries: TimelineEntry[],
  slots: Slots,
): string {
  const charIds = getDistinctCharsBySlot(groupEntries, slots)
  const hexes = charIds.map((id) => {
    const char = getCharacterById(id)
    return (char?.element && ELEMENT_HEX[char.element]) ?? "#888"
  })
  if (hexes.length === 0) return "transparent"
  if (hexes.length === 1)
    return `linear-gradient(90deg, ${hexes[0]}3a 0%, ${hexes[0]}14 50%, transparent 95%)`
  const counts = new Map<number, number>()
  for (const e of groupEntries)
    counts.set(e.characterId, (counts.get(e.characterId) ?? 0) + 1)
  const total = charIds.reduce((s, id) => s + (counts.get(id) ?? 0), 0)
  let acc = 0
  const stops = charIds.map((id, i) => {
    const pct = ((counts.get(id) ?? 0) / total) * 95
    const mid = acc + pct / 2
    acc += pct
    return `${hexes[i]}3a ${mid.toFixed(1)}%`
  })
  return `linear-gradient(90deg, ${stops.join(", ")}, transparent 95%)`
}

export function getGroupFirstCharHex(
  groupEntries: TimelineEntry[],
  slots: Slots,
): string {
  const charIds = getDistinctCharsBySlot(groupEntries, slots)
  const firstId = charIds[0]
  if (firstId === undefined) return "#888"
  const char = getCharacterById(firstId)
  return (char?.element && ELEMENT_HEX[char.element]) ?? "#888"
}

export function getDominantHex(groupEntries: TimelineEntry[]): string {
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
  return (char?.element && ELEMENT_HEX[char.element]) ?? "#888"
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
      className="bg-transparent border-b border-gray-600 text-white text-sm font-bold focus:outline-none focus:border-blue-400 w-40"
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

interface TimelineGroupHeaderProps {
  groupId: string
  label: string
  locked: boolean
  entryCount: number
  groupEntries: TimelineEntry[]
  startFlatIndex: number
  gradient: string
  isExpanded: boolean
  summary: TimelineSummary
  actionEvents: SimulationLogEntry[]
  logMatches: boolean
  drag: TimelineDrag
  onToggleExpand: (groupId: string) => void
  onToggleGroupLock: (groupId: string) => void
  onGroupLabelCommit: (groupId: string, label: string) => void
  onDuplicateGroup: (groupId: string) => void
  onDeleteGroup: (groupId: string) => void
  onRequestDeleteConfirm: (groupId: string) => void
}

export function TimelineGroupHeader({
  groupId,
  label,
  locked,
  entryCount,
  groupEntries,
  startFlatIndex,
  gradient,
  isExpanded,
  summary,
  actionEvents,
  logMatches,
  drag,
  onToggleExpand,
  onToggleGroupLock,
  onGroupLabelCommit,
  onDuplicateGroup,
  onDeleteGroup,
  onRequestDeleteConfirm,
}: TimelineGroupHeaderProps) {
  const { renamingGroupId, startRename, endRename } = useRenamingGroup()
  const reactionDelay = useReactionDelay()
  const { slots, loadouts } = useTeamContext()
  const isRenaming = renamingGroupId === groupId
  const isGroupDropTarget = drag.dropTargetId === `group:${groupId}`
  const isDraggingThisGroup = drag.draggedId === groupId
  const dominantHex = getDominantHex(groupEntries)
  const distinctCharIds = getDistinctCharsBySlot(groupEntries, slots)
  const lastFlatIndex = startFlatIndex + entryCount - 1

  const totalDurationSec = groupEntries.reduce((sum, entry) => {
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
    entryCount > 0
      ? (summary.rows[startFlatIndex]?.time ?? 0).toFixed(2)
      : "0.00"

  const lastConVal =
    isExpanded || entryCount === 0 || !logMatches
      ? null
      : actionEvents[lastFlatIndex]?.kind === "action"
        ? actionEvents[lastFlatIndex].cumulativeConcerto
        : null

  const lastResVal =
    isExpanded || entryCount === 0 || !logMatches
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
    onToggleExpand(groupId)
  }

  const source = drag.groupSource(groupId)
  const target = drag.groupTarget(groupId)

  return (
    <tr
      draggable
      onDragStart={source.onDragStart}
      onDragOver={target.onDragOver}
      onDrop={target.onDrop}
      onDragEnd={source.onDragEnd}
      onClick={handleToggleExpand}
      className={[
        "border-t border-gray-600 cursor-pointer",
        isDraggingThisGroup ? "opacity-40" : "",
        isGroupDropTarget ? "border-t-blue-500 border-t-2" : "",
      ].join(" ")}
      style={{ background: gradient }}
    >
      <td className="w-8 px-2 py-1.5" onClick={handleToggleExpand}>
        <ChevronRightIcon
          style={{
            color: dominantHex,
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-[16px] text-[#a3bfff]">
        {firstRowTime}s
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <div className="flex items-center">
            {distinctCharIds.map((charId, idx) => {
              const char = getCharacterById(charId)
              const hex = (char?.element && ELEMENT_HEX[char.element]) ?? "#888"
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
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = avatarFallbackSrc(
                      char?.name[0].toUpperCase() ?? "?",
                      hex,
                    )
                  }}
                />
              )
            })}
          </div>
          {distinctCharIds.length > 1 && (
            <span className="text-gray-500 font-mono text-xs ml-1">
              × {distinctCharIds.length}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <span
          className="inline-block px-1.5 py-0.5 rounded text-xs font-mono uppercase"
          style={{
            background: `${dominantHex}15`,
            border: `1px solid ${dominantHex}33`,
            color: dominantHex,
          }}
        >
          GROUP
        </span>
      </td>
      <td
        className="px-2 py-1.5 text-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!locked || isRenaming ? (
            <GroupLabelInput
              groupId={groupId}
              initialLabel={label}
              autoFocus={isRenaming}
              onCommit={(gid, l) => {
                onGroupLabelCommit(gid, l)
                endRename()
              }}
            />
          ) : (
            <span
              onClick={(e) => {
                e.stopPropagation()
                startRename(groupId)
              }}
              className="cursor-text hover:text-white transition-colors text-sm font-bold inline-block border-b border-transparent truncate min-w-0"
              title="Click to rename"
            >
              {label || (
                <span className="italic text-gray-600 font-normal">
                  unnamed
                </span>
              )}
            </span>
          )}
          <span className="text-gray-500 text-xs font-mono ml-1 shrink-0">
            {entryCount} actions
          </span>
        </div>
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-[16px] text-gray-300">
        {totalDurationSec.toFixed(2)}s
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {renderPoolValue(lastConVal, "#f5cf4d")}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {renderPoolValue(lastResVal, "#9b6cf0")}
      </td>
      <td className="px-2 py-1.5 font-semibold text-right font-mono">
        {hasDmg ? (
          isExpanded ? (
            <span className="text-[19px] text-gray-600">
              {totalDmg.toLocaleString()}
            </span>
          ) : (
            <span className="font-bold text-[19px] text-yellow-400">
              {totalDmg.toLocaleString()}
            </span>
          )
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleGroupLock(groupId)
            }}
            className={[
              "p-0.5 transition-colors",
              !locked
                ? "text-blue-400 hover:text-blue-300"
                : "text-gray-500 hover:text-gray-400",
            ].join(" ")}
            title={!locked ? "Open — click to lock" : "Locked — click to open"}
            aria-label={!locked ? "Lock group" : "Unlock group"}
          >
            {!locked ? (
              <LockOpenIcon className="w-4 h-4" />
            ) : (
              <LockIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDuplicateGroup(groupId)
            }}
            className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
            title="Duplicate group"
            aria-label="Duplicate group"
          >
            <CopyIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (entryCount >= 2) {
                onRequestDeleteConfirm(groupId)
              } else {
                onDeleteGroup(groupId)
              }
            }}
            className="pl-0.5 pt-px text-gray-500 hover:text-red-400 transition-colors"
            title="Delete group and contents"
            aria-label="Delete group and contents"
          >
            <TrashIcon className="w-4 h-4 mb-px" />
          </button>
        </div>
      </td>
    </tr>
  )
}
