import { useState, useEffect, useRef, useMemo } from "react"
import type { TimelineEntry, TimelineNode } from "#/types/timeline"
import { flattenNodes } from "#/types/timeline"
import type { SimulationLogEntry } from "#/types/simulation-log"
import type { TimelineSummary } from "#/lib/timeline/timeline-summary"
import { validateTimeline } from "#/lib/timeline/validate-timeline"
import { deriveRowDiagnostics } from "#/lib/timeline/log-diagnostics"
import { useTimelineDrag } from "#/hooks/useTimelineDrag"
import type { DropPosition } from "#/hooks/useTimelineDrag"
import { useTeamContext } from "#/hooks/useTeamContext"
import { buildTimelineRenderItems } from "#/lib/timeline/timeline-render-items"
import type { RenderItem } from "#/lib/timeline/timeline-render-items"
import { summarizeGroups } from "#/lib/timeline/timeline-group-summary"
import { applyDragPreview } from "#/lib/timeline/timeline-drag-preview"
import { ConfirmModal } from "../ui/ConfirmModal"
import { EmptyStatement } from "../ui/EmptyStatement"
import { TimelineEntryRow } from "./TimelineEntryRow"
import { TimelineGroupHeader } from "./TimelineGroupHeader"
import { GhostEntryRow } from "./GhostEntryRow"
import { GhostGroupRow } from "./GhostGroupRow"

interface TimelineViewProps {
  nodes: TimelineNode[]
  summary: TimelineSummary
  /** Last run's Simulation Log — engine Diagnostics fold into row warnings. */
  log: SimulationLogEntry[]
  stale?: boolean
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string, position: DropPosition) => void
  onReorderNodes: (fromId: string, toId: string, position: DropPosition) => void
  onUpdateEntry: (id: string, patch: Partial<TimelineEntry>) => void
  onGroupLabelCommit: (groupId: string, label: string) => void
  onToggleGroupLock: (groupId: string) => void
  onDuplicateGroup: (groupId: string) => void
  onDeleteGroup: (groupId: string) => void
  onReorderGroupEntries: (
    groupId: string,
    fromId: string,
    toId: string,
    position: DropPosition,
  ) => void
}

export function TimelineView({
  nodes,
  summary,
  log,
  stale,
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

  const entries = useMemo(() => flattenNodes(nodes), [nodes])

  const validation = useMemo(
    () => validateTimeline(entries, slots, loadouts),
    [entries, slots, loadouts],
  )

  const logWarnings = useMemo(() => deriveRowDiagnostics(log), [log])

  const baseRenderItems = useMemo(
    () =>
      buildTimelineRenderItems(
        nodes,
        expandedGroupIds,
        slots,
        loadouts,
        validation,
        logWarnings,
      ),
    [nodes, expandedGroupIds, slots, loadouts, validation, logWarnings],
  )

  const renderItems = applyDragPreview(baseRenderItems, {
    draggedId: drag.draggedId,
    dropTarget: drag.dropTarget,
  })

  const groupSummaries = useMemo(() => {
    const spans = baseRenderItems
      .filter(
        (it): it is Extract<RenderItem, { type: "groupHeader" }> =>
          it.type === "groupHeader",
      )
      .map((it) => ({
        groupId: it.groupId,
        startFlatIndex: it.startFlatIndex,
        entryCount: it.entryCount,
      }))
    return summarizeGroups(summary.rows, spans)
  }, [baseRenderItems, summary])

  const showWait = summary.rows.some(
    (r) => r.delay.swapBack > 0 || r.delay.priorGate > 0,
  )

  if (entries.length === 0 && nodes.length === 0) {
    return (
      <EmptyStatement
        statement="No rotation yet"
        description="Select a skill from the sidebar to start building your rotation."
      />
    )
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
    <div className="flex-1 min-h-0 overflow-y-scroll">
      <table className="w-full text-sm text-left table-fixed min-w-235">
        <thead className="sticky top-0 z-10 bg-darkest border-b border-border">
          <tr className="text-muted-foreground text-xs font-mono tracking-[1px] uppercase">
            <th className="px-2 py-2 text-right w-7.5">#</th>
            <th className="px-2 py-2 text-right w-18">time</th>
            {showWait && <th className="px-0 py-2 w-7.5"></th>}
            <th className="px-2 py-2 w-36">char</th>
            <th className="px-2 py-2 w-16">type</th>
            <th className="px-2 py-2">skill</th>
            <th className="px-2 py-2 text-right w-16">dur</th>
            <th className="px-2 py-2 text-right w-16">con</th>
            <th className="px-2 py-2 text-right w-16">res</th>
            <th className="px-1 py-2 text-right w-22">dmg</th>
            <th className="px-2 py-2 w-18"></th>
          </tr>
        </thead>
        <tbody>
          {renderItems.map((item) => {
            if (item.type === "ghost") {
              return (
                <GhostEntryRow
                  key={`ghost-${item.sourceId}`}
                  item={item}
                  handlers={drag.ghostHandlers()}
                  showWait={showWait}
                />
              )
            }
            if (item.type === "groupGhost") {
              return (
                <GhostGroupRow
                  key={`groupGhost-${item.sourceGroupId}`}
                  item={item}
                  handlers={drag.ghostHandlers()}
                  showWait={showWait}
                />
              )
            }
            if (item.type === "groupHeader") {
              return (
                <TimelineGroupHeader
                  key={`group-${item.groupId}`}
                  item={item}
                  hidden={item.hidden === true}
                  isExpanded={expandedGroupIds.has(item.groupId)}
                  groupSummaries={groupSummaries}
                  showWait={showWait}
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
            return (
              <TimelineEntryRow
                key={item.entry.id}
                item={item}
                hidden={item.hidden === true}
                prevEntry={i > 0 ? entries[i - 1] : null}
                summary={summary}
                stale={stale}
                showWait={showWait}
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
