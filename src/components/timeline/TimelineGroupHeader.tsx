import { useEffect, useRef } from "react"
import {
  ChevronRightIcon,
  CopyIcon,
  LockIcon,
  LockOpenIcon,
  Trash2,
} from "lucide-react"
import type { GroupSummary } from "#/lib/timeline/timeline-group-summary"
import { ELEMENT_HEX } from "#/data/elements"
import { getCharacterById } from "#/lib/loadout/catalog"
import { CharacterPortrait } from "#/components/ui/CharacterPortrait"
import { IconBtn } from "#/components/ui/IconBtn"
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
  groupSummaries: Map<string, GroupSummary>
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
  groupSummaries,
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
    gradient,
    containerIndex,
  } = item
  const { renamingGroupId, startRename, endRename } = useRenamingGroup()
  const isRenaming = renamingGroupId === groupId
  const isDraggingThisGroup = drag.draggedId === groupId

  const gs = groupSummaries.get(groupId)
  const firstRowTime = formatFrames(gs?.startTimeFrames ?? 0)
  const totalDurFrames = gs?.totalDurationFrames ?? 0
  const totalDamage = gs?.totalDamage ?? null
  const lastConVal = isExpanded ? null : (gs?.endConcerto ?? null)
  const lastResVal = isExpanded ? null : (gs?.endEnergy ?? null)

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
      <td className="px-2 py-1.5 text-right font-mono text-label text-ui-damage">
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
                <CharacterPortrait
                  key={charId}
                  src={`/portraits/${name}.png`}
                  alt={char?.name ?? ""}
                  initial={char?.name[0].toUpperCase() ?? "?"}
                  hex={hex}
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
      <td className="px-2 py-1.5 text-right font-mono text-label text-gray-300">
        {formatFrames(totalDurFrames)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {renderPoolValue(lastConVal, "var(--ui-concerto)")}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {renderPoolValue(lastResVal, "var(--ui-resonance)")}
      </td>
      <td className="px-1 py-1.5 font-semibold text-right font-mono">
        {totalDamage !== null ? (
          isExpanded ? (
            <span className="text-base text-gray-600">
              {totalDamage.toLocaleString()}
            </span>
          ) : (
            <span className="font-bold text-base text-yellow-400">
              {totalDamage.toLocaleString()}
            </span>
          )
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="px-1 py-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end pr-px -my-1">
          <IconBtn
            icon={locked ? LockIcon : LockOpenIcon}
            label={locked ? "Unlock group" : "Lock group"}
            title={locked ? "Locked — click to open" : "Open — click to lock"}
            variant={locked ? "default" : "accent"}
            w={24}
            h={30}
            onClick={() => onToggleGroupLock(groupId)}
          />
          <IconBtn
            icon={CopyIcon}
            label="Duplicate group"
            variant="default"
            w={24}
            h={30}
            onClick={() => onDuplicateGroup(groupId)}
          />
          <IconBtn
            icon={Trash2}
            label="Delete group and contents"
            variant="destructive"
            w={24}
            h={30}
            onClick={() => {
              if (entryCount >= 2) {
                onRequestDeleteConfirm(groupId)
              } else {
                onDeleteGroup(groupId)
              }
            }}
          />
        </div>
      </td>
    </tr>
  )
}
