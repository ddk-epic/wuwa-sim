import type { RenderItem } from "./timeline-render-items"
import type { DropPosition } from "#/hooks/useTimelineDrag"

export interface DragPreviewState {
  draggedId: string | null
  dropTarget: { id: string; position: DropPosition } | null
}

/** Insert index for a node-level target (`group:<id>` or a top-level entry). */
function resolveNodeInsertIdx(
  items: RenderItem[],
  dropTarget: { id: string; position: DropPosition },
): number {
  if (dropTarget.id.startsWith("group:")) {
    const targetGroupId = dropTarget.id.slice(6)
    const targetHeaderIdx = items.findIndex(
      (item) => item.type === "groupHeader" && item.groupId === targetGroupId,
    )
    if (targetHeaderIdx === -1) return -1
    if (dropTarget.position === "above") return targetHeaderIdx
    // Below: insert after the last visible row of the target group.
    let lastIdx = targetHeaderIdx
    for (let j = targetHeaderIdx + 1; j < items.length; j++) {
      const it = items[j]
      if (it.type === "entry" && it.groupId === targetGroupId) lastIdx = j
      else break
    }
    return lastIdx + 1
  }
  const targetEntryIdx = items.findIndex(
    (item) => item.type === "entry" && item.entry.id === dropTarget.id,
  )
  if (targetEntryIdx === -1) return -1
  return dropTarget.position === "above" ? targetEntryIdx : targetEntryIdx + 1
}

/**
 * Inserts a ghost render item at the resolved drop destination and marks
 * the source entry, group, or loop marker as hidden. Returns items unchanged
 * when no drag is active or when there is no drop target.
 *
 * Entry source: inserts a `type: 'ghost'` row at the resolved entry target.
 * Group source: inserts a `type: 'groupGhost'` row at the resolved node target
 * (group or top-level entry); hides the entire group block.
 * Loop-marker source: inserts a `type: 'loopMarkerGhost'` row at the resolved
 * node target; hides the marker's own row.
 */
export function applyDragPreview(
  items: RenderItem[],
  dragState: DragPreviewState,
): RenderItem[] {
  const { draggedId, dropTarget } = dragState
  if (!draggedId || !dropTarget) return items

  // --- Loop-marker source branch ---
  const markerIdx = items.findIndex(
    (item) => item.type === "loopMarker" && item.markerId === draggedId,
  )
  if (markerIdx !== -1) {
    const insertIdx = resolveNodeInsertIdx(items, dropTarget)
    if (insertIdx === -1) return items
    const result: RenderItem[] = items.map((item, i) =>
      i === markerIdx ? { ...item, hidden: true } : item,
    )
    result.splice(insertIdx, 0, {
      type: "loopMarkerGhost",
      sourceId: draggedId,
    })
    return result
  }

  // --- Entry source branch ---
  if (!dropTarget.id.startsWith("group:")) {
    const sourceIdx = items.findIndex(
      (item) => item.type === "entry" && item.entry.id === draggedId,
    )
    if (sourceIdx !== -1) {
      const sourceItem = items[sourceIdx]
      if (sourceItem.type !== "entry") return items
      const targetIdx = items.findIndex(
        (item) => item.type === "entry" && item.entry.id === dropTarget.id,
      )
      if (targetIdx === -1) return items

      const result: RenderItem[] = items.map((item, i) =>
        i === sourceIdx ? { ...item, hidden: true } : item,
      )
      const ghost: Extract<RenderItem, { type: "ghost" }> = {
        type: "ghost",
        sourceId: draggedId,
        charHex: sourceItem.charHex,
        skillName: sourceItem.skillName,
      }
      const insertIdx =
        dropTarget.position === "above" ? targetIdx : targetIdx + 1
      result.splice(insertIdx, 0, ghost)
      return result
    }
  }

  // --- Group source branch ---
  const sourceHeader = items.find(
    (item): item is Extract<RenderItem, { type: "groupHeader" }> =>
      item.type === "groupHeader" && item.groupId === draggedId,
  )
  if (!sourceHeader) return items

  const targetInsertIdx = resolveNodeInsertIdx(items, dropTarget)
  if (targetInsertIdx === -1) return items

  // Hide source group header and all its expanded entry rows
  const result: RenderItem[] = items.map((item) => {
    if (item.type === "groupHeader" && item.groupId === draggedId) {
      return { ...item, hidden: true }
    }
    if (item.type === "entry" && item.groupId === draggedId) {
      return { ...item, hidden: true }
    }
    return item
  })

  const groupGhost: Extract<RenderItem, { type: "groupGhost" }> = {
    type: "groupGhost",
    sourceGroupId: draggedId,
    label: sourceHeader.label,
    entryCount: sourceHeader.entryCount,
    dominantHex: sourceHeader.dominantHex,
    distinctCharIds: sourceHeader.distinctCharIds,
  }
  result.splice(targetInsertIdx, 0, groupGhost)
  return result
}
