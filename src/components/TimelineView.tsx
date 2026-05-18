import { useState, useEffect, useMemo } from "react"
import type { TimelineEntry, TimelineNode } from "#/types/timeline"
import { flattenNodes } from "#/types/timeline"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineSummary } from "#/lib/timeline-summary"
import type { SimulationLogEntry } from "#/types/simulation-log"
import { validateTimeline } from "#/lib/validate-timeline"
import { useTimelineDrag } from "#/hooks/useTimelineDrag"
import { ConfirmModal } from "./ConfirmModal"
import { TimelineEntryRow } from "./TimelineEntryRow"
import { TimelineGroupHeader } from "./TimelineGroupHeader"

interface TimelineViewProps {
  nodes: TimelineNode[]
  summary: TimelineSummary
  slots: Slots
  loadouts: SlotLoadout[]
  log: SimulationLogEntry[]
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
  onReorderNodes: (fromId: string, toId: string) => void
  onUpdateEntry: (id: string, patch: Partial<TimelineEntry>) => void
  onGroupLabelCommit: (groupId: string, label: string) => void
  onToggleGroupLock: (groupId: string) => void
  onDuplicateGroup: (groupId: string) => void
  onDeleteGroup: (groupId: string) => void
  onReorderGroupEntries: (groupId: string, fromId: string, toId: string) => void
}

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

export function TimelineView({
  nodes,
  summary,
  slots,
  loadouts,
  log,
  onRemove,
  onReorder,
  onReorderNodes,
  onUpdateEntry,
  onGroupLabelCommit,
  onToggleGroupLock,
  onDuplicateGroup,
  onDeleteGroup,
  onReorderGroupEntries,
}: TimelineViewProps) {
  const drag = useTimelineDrag()
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
      for (const id of groupIds) {
        if (prev.has(id)) next.add(id)
        else next.add(id)
      }
      if (next.size === prev.size && [...next].every((id) => prev.has(id)))
        return prev
      return next
    })
  }, [nodes])

  const entries = flattenNodes(nodes)

  const validation = useMemo(
    () => validateTimeline(entries, slots, loadouts),
    [entries, slots, loadouts],
  )

  if (entries.length === 0 && nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">
        Select a skill from the sidebar to build your rotation
      </div>
    )
  }

  const rowsWithMessages = entries.reduce<number[]>((acc, e, i) => {
    if ((validation.rowErrors.get(e.id)?.length ?? 0) > 0) acc.push(i)
    return acc
  }, [])
  const messageIndexes = new Set(rowsWithMessages.slice(0, 2))

  const actionEvents = log.filter((e) => e.kind === "action")
  const logMatches = actionEvents.length === entries.length

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
        groupEntries: node.entries,
        startFlatIndex,
      })
      if (isExpanded) {
        node.entries.forEach((entry, entryIdx) => {
          renderItems.push({
            type: "entry",
            entry,
            flatIndex: flatIndex++,
            inGroup: true,
            groupId: node.id,
            groupLocked: node.locked,
            isLastInGroup: entryIdx === node.entries.length - 1,
          })
        })
      } else {
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

  function toggleExpand(groupId: string) {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <table className="w-full text-sm text-left">
        <thead className="sticky top-0 z-10 bg-darkest border-b border-border">
          <tr className="text-muted-foreground text-xs font-mono tracking-[1px] uppercase">
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
              return (
                <TimelineGroupHeader
                  key={`group-${item.groupId}`}
                  groupId={item.groupId}
                  label={item.label}
                  locked={item.locked}
                  entryCount={item.entryCount}
                  groupEntries={item.groupEntries}
                  startFlatIndex={item.startFlatIndex}
                  isExpanded={expandedGroupIds.has(item.groupId)}
                  slots={slots}
                  loadouts={loadouts}
                  summary={summary}
                  actionEvents={actionEvents}
                  logMatches={logMatches}
                  drag={drag}
                  onToggleExpand={toggleExpand}
                  onReorderNodes={onReorderNodes}
                  onToggleGroupLock={onToggleGroupLock}
                  onGroupLabelCommit={onGroupLabelCommit}
                  onDuplicateGroup={onDuplicateGroup}
                  onDeleteGroup={onDeleteGroup}
                  onRequestDeleteConfirm={setDeletingGroupId}
                />
              )
            }
            const i = item.flatIndex
            const ev = actionEvents[i]
            const actionEventAtIndex =
              logMatches && ev?.kind === "action" ? ev : undefined
            return (
              <TimelineEntryRow
                key={item.entry.id}
                entry={item.entry}
                index={i}
                inGroup={item.inGroup}
                groupId={item.groupId}
                groupLocked={item.groupLocked}
                isLastInGroup={item.isLastInGroup}
                prevEntry={i > 0 ? entries[i - 1] : null}
                summary={summary}
                slots={slots}
                loadouts={loadouts}
                validation={validation}
                showMessage={
                  validation.invalidRowIds.has(item.entry.id) &&
                  messageIndexes.has(i)
                }
                actionEventAtIndex={actionEventAtIndex}
                drag={drag}
                onRemove={onRemove}
                onUpdateEntry={onUpdateEntry}
                onReorder={onReorder}
                onReorderNodes={onReorderNodes}
                onReorderGroupEntries={onReorderGroupEntries}
              />
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
