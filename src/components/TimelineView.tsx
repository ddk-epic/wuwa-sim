import { useState, useEffect, useRef, useMemo } from "react"
import type { TimelineEntry, TimelineNode } from "#/types/timeline"
import { flattenNodes } from "#/types/timeline"
import type { TimelineSummary } from "#/lib/timeline-summary"
import type { SimulationLogEntry } from "#/types/simulation-log"
import { validateTimeline } from "#/lib/validate-timeline"
import { useTimelineDrag } from "#/hooks/useTimelineDrag"
import { useTeamContext } from "#/hooks/useTeamContext"
import { buildTimelineRenderItems } from "#/lib/timeline-render-items"
import { ConfirmModal } from "./ConfirmModal"
import { TimelineEntryRow } from "./TimelineEntryRow"
import { TimelineGroupHeader } from "./TimelineGroupHeader"

interface TimelineViewProps {
  nodes: TimelineNode[]
  summary: TimelineSummary
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

export function TimelineView({
  nodes,
  summary,
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
  const { slots, loadouts } = useTeamContext()
  const drag = useTimelineDrag({
    onReorderTopLevelEntry: onReorder,
    onReorderNodes,
    onReorderGroupEntries,
  })
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const getGroupIds = (ns: TimelineNode[]) =>
    new Set(
      ns
        .filter(
          (n): n is Extract<TimelineNode, { kind: "group" }> =>
            n.kind === "group",
        )
        .map((n) => n.id),
    )

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() =>
    getGroupIds(nodes),
  )
  const knownGroupIds = useRef<Set<string>>(getGroupIds(nodes))

  useEffect(() => {
    const currentGroupIds = getGroupIds(nodes)
    setExpandedGroupIds((prev) => {
      const next = new Set<string>()
      for (const id of currentGroupIds) {
        if (prev.has(id)) next.add(id)
        else if (!knownGroupIds.current.has(id)) next.add(id) // truly new group — auto-expand
      }
      if (next.size === prev.size && [...next].every((id) => prev.has(id)))
        return prev
      return next
    })
    knownGroupIds.current = currentGroupIds
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

  const renderItems = useMemo(
    () => buildTimelineRenderItems(nodes, expandedGroupIds, slots),
    [nodes, expandedGroupIds, slots],
  )

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
      <table className="w-full text-sm text-left table-fixed min-w-235">
        <thead className="sticky top-0 z-10 bg-darkest border-b border-border">
          <tr className="text-muted-foreground text-xs font-mono tracking-[1px] uppercase">
            <th className="px-2 py-2 text-right w-7.5">#</th>
            <th className="px-2 py-2 text-right w-18">time</th>
            <th className="px-2 py-2 w-36">char</th>
            <th className="px-2 py-2 w-16">type</th>
            <th className="px-2 py-2">skill</th>
            <th className="px-2 py-2 text-right w-18">dur</th>
            <th className="px-2 py-2 text-right w-20">con</th>
            <th className="px-2 py-2 text-right w-20">res</th>
            <th className="px-2 py-2 text-right w-24">dmg</th>
            <th className="px-2 py-2 w-20.75"></th>
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
                  dominantHex={item.dominantHex}
                  distinctCharIds={item.distinctCharIds}
                  startFlatIndex={item.startFlatIndex}
                  gradient={item.gradient}
                  isExpanded={expandedGroupIds.has(item.groupId)}
                  summary={summary}
                  actionEvents={actionEvents}
                  logMatches={logMatches}
                  drag={drag}
                  onToggleExpand={toggleExpand}
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
                lastInGroupGradient={item.lastInGroupGradient}
                groupFirstCharHex={item.groupFirstCharHex}
                prevEntry={i > 0 ? entries[i - 1] : null}
                summary={summary}
                validation={validation}
                showMessage={
                  validation.invalidRowIds.has(item.entry.id) &&
                  messageIndexes.has(i)
                }
                actionEventAtIndex={actionEventAtIndex}
                drag={drag}
                onRemove={onRemove}
                onUpdateEntry={onUpdateEntry}
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
