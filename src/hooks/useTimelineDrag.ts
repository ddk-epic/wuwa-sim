import { useState } from "react"
import type React from "react"

export type DragKind = "entry" | "group"

export interface DragSrcCtx {
  groupId: string | null
  locked: boolean
}

export type DragSource =
  | { kind: "entry"; id: string; groupId: string | null; locked: boolean }
  | { kind: "group"; id: string }

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

export interface TimelineDropHandlers {
  onReorderTopLevelEntry: (fromId: string, toId: string) => void
  onReorderNodes: (fromId: string, toId: string) => void
  onReorderGroupEntries: (groupId: string, fromId: string, toId: string) => void
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
  dropTargetId: string | null
  entrySource: (entryId: string, ctx: EntrySourceCtx) => DragHandlerBundle
  entryTarget: (entryId: string, ctx: EntryTargetCtx) => DropHandlerBundle
  groupSource: (groupId: string) => DragHandlerBundle
  groupTarget: (groupId: string) => DropHandlerBundle
}

export function useTimelineDrag(handlers: TimelineDropHandlers): TimelineDrag {
  const [source, setSource] = useState<DragSource | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  function clear() {
    setSource(null)
    setDropTargetId(null)
  }

  function dispatch(decision: DropDecision) {
    switch (decision.kind) {
      case "reorderTopLevelEntry":
        handlers.onReorderTopLevelEntry(decision.from, decision.to)
        return
      case "reorderGroupEntries":
        handlers.onReorderGroupEntries(
          decision.groupId,
          decision.from,
          decision.to,
        )
        return
      case "reorderNodes":
        handlers.onReorderNodes(decision.from, decision.to)
        return
      case "none":
        return
    }
  }

  return {
    draggedId: source?.id ?? null,
    dropTargetId,
    entrySource(entryId, ctx) {
      return {
        onDragStart(ev) {
          ev.dataTransfer.effectAllowed = "move"
          setSource({
            kind: "entry",
            id: entryId,
            groupId: ctx.groupId,
            locked: ctx.locked,
          })
        },
        onDragEnd: clear,
      }
    },
    entryTarget(entryId, ctx) {
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
          ev.preventDefault()
          ev.dataTransfer.dropEffect = "move"
          if (entryId !== source.id) setDropTargetId(entryId)
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
          ev.preventDefault()
          dispatch(decision)
          clear()
        },
      }
    },
    groupSource(groupId) {
      return {
        onDragStart(ev) {
          ev.dataTransfer.effectAllowed = "move"
          setSource({ kind: "group", id: groupId })
        },
        onDragEnd: clear,
      }
    },
    groupTarget(groupId) {
      return {
        onDragOver(ev) {
          if (!source) return
          const decision = decideDrop(source, { kind: "group", groupId })
          if (decision.kind === "none") return
          ev.preventDefault()
          ev.dataTransfer.dropEffect = "move"
          if (source.id !== groupId) setDropTargetId(`group:${groupId}`)
        },
        onDrop(ev) {
          if (!source) return
          const decision = decideDrop(source, { kind: "group", groupId })
          if (decision.kind === "none") {
            clear()
            return
          }
          ev.preventDefault()
          dispatch(decision)
          clear()
        },
      }
    },
  }
}
