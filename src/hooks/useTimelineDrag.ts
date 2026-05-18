import { useState } from "react"

export type DragKind = "entry" | "group"

export interface DragSrcCtx {
  groupId: string | null
  locked: boolean
}

export function isDropAllowed(
  srcCtx: DragSrcCtx | null,
  targetGroupId: string | null,
  targetGroupLocked: boolean,
): boolean {
  if (!srcCtx) return true
  const { groupId: srcGroupId, locked: srcLocked } = srcCtx
  if (srcLocked) return targetGroupId === srcGroupId
  if (targetGroupLocked && targetGroupId !== srcGroupId) return false
  return true
}

export interface TimelineDrag {
  draggedId: string | null
  draggingType: DragKind | null
  dragSrcCtx: DragSrcCtx | null
  dropTargetId: string | null
  startDrag: (id: string, type: DragKind, ctx: DragSrcCtx | null) => void
  setDropTarget: (id: string | null) => void
  clearDrag: () => void
  isDropAllowed: (
    targetGroupId: string | null,
    targetGroupLocked: boolean,
  ) => boolean
}

export function useTimelineDrag(): TimelineDrag {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [draggingType, setDraggingType] = useState<DragKind | null>(null)
  const [dragSrcCtx, setDragSrcCtx] = useState<DragSrcCtx | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  return {
    draggedId,
    draggingType,
    dragSrcCtx,
    dropTargetId,
    startDrag(id, type, ctx) {
      setDraggedId(id)
      setDraggingType(type)
      setDragSrcCtx(ctx)
    },
    setDropTarget(id) {
      setDropTargetId(id)
    },
    clearDrag() {
      setDraggedId(null)
      setDraggingType(null)
      setDragSrcCtx(null)
      setDropTargetId(null)
    },
    isDropAllowed(targetGroupId, targetGroupLocked) {
      return isDropAllowed(dragSrcCtx, targetGroupId, targetGroupLocked)
    },
  }
}
