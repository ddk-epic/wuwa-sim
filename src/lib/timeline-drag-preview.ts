import type { RenderItem } from "./timeline-render-items"
import type { DropPosition } from "#/hooks/useTimelineDrag"

export interface DragPreviewState {
  draggedId: string | null
  dropTarget: { id: string; position: DropPosition } | null
}

/**
 * Inserts a ghost render item at the resolved drop destination and marks
 * the source entry as hidden. Returns items unchanged when no drag is active,
 * when there is no drop target, or when the source is a group (group ghost
 * deferred to a follow-up issue).
 */
export function applyDragPreview(
  items: RenderItem[],
  dragState: DragPreviewState,
): RenderItem[] {
  const { draggedId, dropTarget } = dragState
  if (!draggedId || !dropTarget) return items

  // Skip group targets (id prefixed with "group:")
  if (dropTarget.id.startsWith("group:")) return items

  // Find source entry item
  const sourceIdx = items.findIndex(
    (item) => item.type === "entry" && item.entry.id === draggedId,
  )
  if (sourceIdx === -1) return items // source is a group — deferred

  const sourceItem = items[sourceIdx] as Extract<RenderItem, { type: "entry" }>

  // Find target entry item
  const targetIdx = items.findIndex(
    (item) => item.type === "entry" && item.entry.id === dropTarget.id,
  )
  if (targetIdx === -1) return items

  // Mark source as hidden (collapsed to 0 height via display:none in view)
  const result: RenderItem[] = items.map((item, i) =>
    i === sourceIdx ? { ...item, hidden: true } : item,
  )

  const ghost: Extract<RenderItem, { type: "ghost" }> = {
    type: "ghost",
    sourceId: draggedId,
    charHex: sourceItem.charHex,
    skillName: sourceItem.skillName,
  }

  const insertIdx = dropTarget.position === "above" ? targetIdx : targetIdx + 1
  result.splice(insertIdx, 0, ghost)

  return result
}
