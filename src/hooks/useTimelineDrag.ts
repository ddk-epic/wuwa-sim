import { useState } from "react"
import type React from "react"

export type DragKind = "entry" | "group"
export type DropPosition = "above" | "below"

export interface DragSrcCtx {
  groupId: string | null
  locked: boolean
}

export type DragSource =
  | {
      kind: "entry"
      id: string
      groupId: string | null
      locked: boolean
      containerIndex: number
    }
  | { kind: "group"; id: string; containerIndex: number }

export type DropTarget =
  | { kind: "entry"; id: string; groupId: string | null; groupLocked: boolean }
  | { kind: "group"; groupId: string }

export type DropDecision =
  | { kind: "none" }
  | { kind: "reorderTopLevelEntry"; from: string; to: string }
  | { kind: "reorderGroupEntries"; groupId: string; from: string; to: string }
  | { kind: "reorderNodes"; from: string; to: string }

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

export function decideDrop(src: DragSource, target: DropTarget): DropDecision {
  if (target.kind === "entry") {
    if (src.kind === "entry" && src.id === target.id) return { kind: "none" }
    const srcCtx: DragSrcCtx | null =
      src.kind === "entry" ? { groupId: src.groupId, locked: src.locked } : null
    if (!isDropAllowed(srcCtx, target.groupId, target.groupLocked))
      return { kind: "none" }

    if (src.kind === "entry") {
      if (src.groupId === null && target.groupId === null) {
        return { kind: "reorderTopLevelEntry", from: src.id, to: target.id }
      }
      if (
        src.groupId !== null &&
        target.groupId !== null &&
        src.groupId === target.groupId
      ) {
        return {
          kind: "reorderGroupEntries",
          groupId: src.groupId,
          from: src.id,
          to: target.id,
        }
      }
      return { kind: "none" }
    }
    if (target.groupId === null) {
      return { kind: "reorderNodes", from: src.id, to: target.id }
    }
    return { kind: "none" }
  }

  if (src.kind === "group") {
    if (src.id === target.groupId) return { kind: "none" }
    return { kind: "reorderNodes", from: src.id, to: target.groupId }
  }
  if (src.groupId === null) {
    return { kind: "reorderNodes", from: src.id, to: target.groupId }
  }
  return { kind: "none" }
}

function resolvePosition(ev: React.DragEvent): DropPosition {
  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  return ev.clientY < rect.top + rect.height / 2 ? "above" : "below"
}

export function isNoOp(
  srcIdx: number,
  targetIdx: number,
  position: DropPosition,
): boolean {
  return (
    (position === "above" && targetIdx === srcIdx + 1) ||
    (position === "below" && targetIdx === srcIdx - 1)
  )
}

export interface TimelineDropHandlers {
  onReorderTopLevelEntry: (
    fromId: string,
    toId: string,
    position: DropPosition,
  ) => void
  onReorderNodes: (fromId: string, toId: string, position: DropPosition) => void
  onReorderGroupEntries: (
    groupId: string,
    fromId: string,
    toId: string,
    position: DropPosition,
  ) => void
}

export interface EntrySourceCtx {
  groupId: string | null
  locked: boolean
}

export interface EntryTargetCtx {
  groupId: string | null
  groupLocked: boolean
}

export interface DragHandlerBundle {
  onDragStart: (ev: React.DragEvent) => void
  onDragEnd: () => void
}

export interface DropHandlerBundle {
  onDragOver: (ev: React.DragEvent) => void
  onDrop: (ev: React.DragEvent) => void
}

export interface TimelineDrag {
  draggedId: string | null
  dropTarget: { id: string; position: DropPosition } | null
  entrySource: (
    entryId: string,
    ctx: EntrySourceCtx,
    containerIndex: number,
  ) => DragHandlerBundle
  entryTarget: (
    entryId: string,
    ctx: EntryTargetCtx,
    containerIndex: number,
  ) => DropHandlerBundle
  groupSource: (groupId: string, containerIndex: number) => DragHandlerBundle
  groupTarget: (groupId: string, containerIndex: number) => DropHandlerBundle
  ghostHandlers: () => DropHandlerBundle
}

export function useTimelineDrag(handlers: TimelineDropHandlers): TimelineDrag {
  const [source, setSource] = useState<DragSource | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    id: string
    position: DropPosition
  } | null>(null)
  const [pending, setPending] = useState<{
    decision: Exclude<DropDecision, { kind: "none" }>
    position: DropPosition
  } | null>(null)

  function clear() {
    setSource(null)
    setDropTarget(null)
    setPending(null)
  }

  function dispatch(
    decision: Exclude<DropDecision, { kind: "none" }>,
    position: DropPosition,
  ) {
    switch (decision.kind) {
      case "reorderTopLevelEntry":
        handlers.onReorderTopLevelEntry(decision.from, decision.to, position)
        return
      case "reorderGroupEntries":
        handlers.onReorderGroupEntries(
          decision.groupId,
          decision.from,
          decision.to,
          position,
        )
        return
      case "reorderNodes":
        handlers.onReorderNodes(decision.from, decision.to, position)
        return
    }
  }

  return {
    draggedId: source?.id ?? null,
    dropTarget,
    entrySource(entryId, ctx, containerIndex) {
      return {
        onDragStart(ev) {
          ev.dataTransfer.effectAllowed = "move"
          setSource({
            kind: "entry",
            id: entryId,
            groupId: ctx.groupId,
            locked: ctx.locked,
            containerIndex,
          })
        },
        onDragEnd: clear,
      }
    },
    entryTarget(entryId, ctx, containerIndex) {
      return {
        onDragOver(ev) {
          if (!source) return
          const decision = decideDrop(source, {
            kind: "entry",
            id: entryId,
            groupId: ctx.groupId,
            groupLocked: ctx.groupLocked,
          })
          if (decision.kind === "none") return
          const position = resolvePosition(ev)
          if (
            entryId === source.id ||
            isNoOp(source.containerIndex, containerIndex, position)
          ) {
            setDropTarget(null)
            setPending(null)
            return
          }
          ev.preventDefault()
          ev.dataTransfer.dropEffect = "move"
          setDropTarget({ id: entryId, position })
          setPending({ decision, position })
        },
        onDrop(ev) {
          if (!source) return
          const decision = decideDrop(source, {
            kind: "entry",
            id: entryId,
            groupId: ctx.groupId,
            groupLocked: ctx.groupLocked,
          })
          if (decision.kind === "none") {
            clear()
            return
          }
          const position = resolvePosition(ev)
          if (
            entryId === source.id ||
            isNoOp(source.containerIndex, containerIndex, position)
          ) {
            clear()
            return
          }
          ev.preventDefault()
          dispatch(decision, position)
          clear()
        },
      }
    },
    groupSource(groupId, containerIndex) {
      return {
        onDragStart(ev) {
          ev.dataTransfer.effectAllowed = "move"
          setSource({ kind: "group", id: groupId, containerIndex })
        },
        onDragEnd: clear,
      }
    },
    groupTarget(groupId, containerIndex) {
      return {
        onDragOver(ev) {
          if (!source) return
          const decision = decideDrop(source, { kind: "group", groupId })
          if (decision.kind === "none") return
          const position = resolvePosition(ev)
          if (
            source.id === groupId ||
            isNoOp(source.containerIndex, containerIndex, position)
          ) {
            setDropTarget(null)
            setPending(null)
            return
          }
          ev.preventDefault()
          ev.dataTransfer.dropEffect = "move"
          setDropTarget({ id: `group:${groupId}`, position })
          setPending({ decision, position })
        },
        onDrop(ev) {
          if (!source) return
          const decision = decideDrop(source, { kind: "group", groupId })
          if (decision.kind === "none") {
            clear()
            return
          }
          const position = resolvePosition(ev)
          if (
            source.id === groupId ||
            isNoOp(source.containerIndex, containerIndex, position)
          ) {
            clear()
            return
          }
          ev.preventDefault()
          dispatch(decision, position)
          clear()
        },
      }
    },
    ghostHandlers() {
      return {
        onDragOver(ev) {
          if (!source || !pending) return
          ev.preventDefault()
          ev.dataTransfer.dropEffect = "move"
        },
        onDrop(ev) {
          if (!source || !pending) {
            clear()
            return
          }
          ev.preventDefault()
          dispatch(pending.decision, pending.position)
          clear()
        },
      }
    },
  }
}
