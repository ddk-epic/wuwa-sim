import {
  ChevronRightIcon,
  CopyIcon,
  LockIcon,
  LockOpenIcon,
  Trash2,
} from "lucide-react"
import type { GroupSummary } from "#/lib/timeline/timeline-group-summary"
import { characterVisual } from "#/components/ui/character-visual"
import { CharacterPortrait } from "#/components/ui/CharacterPortrait"
import { IconBtn } from "#/components/ui/IconBtn"
import { InlineRename } from "#/components/ui/InlineRename"
import { HexPill } from "#/components/ui/HexPill"
import { getCharacterById } from "#/lib/loadout/catalog"
import type { TimelineDrag } from "#/hooks/useTimelineDrag"
import { useRenamingGroup } from "#/hooks/useRenamingGroup"
import { TimeCell, WaitCell, DurationCell, PoolCell } from "./timeline-cells"
import type { RenderItem } from "#/lib/timeline/timeline-render-items"

type GroupHeaderRenderItem = Extract<RenderItem, { type: "groupHeader" }>

interface TimelineGroupHeaderProps {
  item: GroupHeaderRenderItem
  isExpanded: boolean
  groupSummaries: Map<string, GroupSummary>
  drag: TimelineDrag
  hidden?: boolean
  showWait?: boolean
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
  showWait = false,
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
    lastCharId,
    gradient,
    containerIndex,
  } = item
  const { renamingGroupId, endRename } = useRenamingGroup()
  const isDraggingThisGroup = drag.draggedId === groupId

  const gs = groupSummaries.get(groupId)
  const totalDurFrames = gs?.totalDurationFrames ?? 0
  const totalDamage = gs?.totalDamage ?? null
  const lastConVal = isExpanded ? null : (gs?.endConcerto ?? null)
  const lastResVal = isExpanded ? null : (gs?.endEnergy ?? null)
  const lastMaxEnergy =
    (lastCharId !== null ? getCharacterById(lastCharId)?.maxEnergy : null) ??
    100

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
      <TimeCell frames={gs?.startTimeFrames ?? 0} />
      {showWait && <WaitCell />}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <div className="flex items-center">
            {distinctCharIds.map((charId, idx) => {
              const v = characterVisual(charId)
              const hex = v.hex
              return (
                <CharacterPortrait
                  key={charId}
                  src={v.portraitSrc}
                  alt={v.name}
                  initial={v.initial}
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
        <HexPill hex={dominantHex}>GROUP</HexPill>
      </td>
      <td
        className="px-2 py-1.5 text-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <InlineRename
            value={label}
            readOnly={locked}
            autoEdit={renamingGroupId === groupId}
            onEditingChange={(next) => {
              if (!next) endRename()
            }}
            onCommit={(l) => onGroupLabelCommit(groupId, l)}
            placeholder="unnamed"
            title={locked ? undefined : "Click to rename"}
            wrapperClassName="pr-2 py-0.75 -my-2"
            activeWrapperClassName="hover:w-40 focus-within:w-40"
            className="text-sm font-bold"
            inputClassName="w-full"
          />
          <span className="text-gray-500 text-xs font-mono shrink-0">
            {entryCount} actions
          </span>
        </div>
      </td>
      <DurationCell frames={totalDurFrames} />
      <PoolCell value={lastConVal} resource="concerto" threshold={100} />
      <PoolCell
        value={lastResVal}
        resource="energy"
        threshold={lastMaxEnergy}
      />
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
