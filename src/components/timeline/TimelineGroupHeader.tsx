import { useEffect, useRef } from "react"
import {
  ChevronRightIcon,
  CopyIcon,
  LockIcon,
  LockOpenIcon,
  TrashIcon,
} from "lucide-react"
import type { TimelineSummary } from "#/lib/timeline/timeline-summary"
import { ELEMENT_HEX } from "#/data/elements"
import { getCharacterById } from "#/lib/loadout/catalog"
import { avatarFallbackSrc } from "#/lib/avatar-fallback"
import type { TimelineDrag } from "#/hooks/useTimelineDrag"
import { useRenamingGroup } from "#/hooks/useRenamingGroup"
import { renderPoolValue } from "../log/log-cells"
import { formatFrames } from "#/lib/format"
import type { RenderItem } from "#/lib/timeline/timeline-render-items"

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

type GroupHeaderRenderItem = Extract<RenderItem, { type: "groupHeader" }>

interface TimelineGroupHeaderProps {
  item: GroupHeaderRenderItem
  isExpanded: boolean
  summary: TimelineSummary
  drag: TimelineDrag
  hidden?: boolean
  onToggleExpand: (groupId: string) => void
  onToggleGroupLock: (groupId: string) => void
  onGroupLabelCommit: (groupId: string, label: string) => void
  onDuplicateGroup: (groupId: string) => void
  onDeleteGroup: (groupId: string) => void
  onRequestDeleteConfirm: (groupId: string) => void
}

export function TimelineGroupHeader({
  item,
  isExpanded,
  summary,
  drag,
  hidden = false,
  onToggleExpand,
  onToggleGroupLock,
  onGroupLabelCommit,
  onDuplicateGroup,
  onDeleteGroup,
  onRequestDeleteConfirm,
}: TimelineGroupHeaderProps) {
  const {
    groupId,
    label,
    locked,
    entryCount,
    dominantHex,
    distinctCharIds,
    startFlatIndex,
    gradient,
    containerIndex,
  } = item
  const { renamingGroupId, startRename, endRename } = useRenamingGroup()
  const isRenaming = renamingGroupId === groupId
  const isDraggingThisGroup = drag.draggedId === groupId
  const lastFlatIndex = startFlatIndex + entryCount - 1

  let totalDurFrames = 0
  for (let i = 0; i < entryCount; i++) {
    totalDurFrames += summary.rows[startFlatIndex + i]?.durationFrames ?? 0
  }
  const firstRowTime =
    entryCount > 0
      ? formatFrames(summary.rows[startFlatIndex]?.timeFrames ?? 0)
      : "0.00s"

  const lastRow =
    !isExpanded && entryCount > 0 ? (summary.rows[lastFlatIndex] ?? null) : null
  const lastConVal = lastRow?.cumulativeConcerto ?? null
  const lastResVal = lastRow?.cumulativeEnergy ?? null

  let totalDmg = 0
  let hasDmg = false
  for (let i = startFlatIndex; i <= lastFlatIndex; i++) {
    const d = summary.rows[i].damage
    if (d !== null) {
      totalDmg += d
      hasDmg = true
    }
  }

  function handleToggleExpand(e: React.MouseEvent) {
    e.stopPropagation()
    onToggleExpand(groupId)
  }

  const source = drag.groupSource(groupId, containerIndex)
  const target = drag.groupTarget(groupId, containerIndex)

  return (
    <tr
      draggable
      onDragStart={source.onDragStart}
      onDragOver={target.onDragOver}
      onDrop={target.onDrop}
      onDragEnd={source.onDragEnd}
      onClick={handleToggleExpand}
      className={[
        "border-t border-gray-600 cursor-grab",
        isDraggingThisGroup ? "opacity-40" : "",
      ].join(" ")}
      style={{ background: gradient, ...(hidden ? { display: "none" } : {}) }}
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
        {firstRowTime}
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
                <span className="italic text-gray-600 font-normal pr-0.5">
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
        {formatFrames(totalDurFrames)}
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
      <td className="px-1 py-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center -my-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleGroupLock(groupId)
            }}
            className={[
              "px-0.75 py-1.5 transition-colors",
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
            className="px-0.75 py-1.5 text-gray-500 hover:text-gray-300 transition-colors"
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
            className="px-0.75 py-1.5 text-gray-500 hover:text-red-400 transition-colors"
            title="Delete group and contents"
            aria-label="Delete group and contents"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}
