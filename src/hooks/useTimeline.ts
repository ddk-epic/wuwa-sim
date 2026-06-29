import { useMemo } from "react"
import type {
  TimelineEntry,
  TimelineGroup,
  TimelineNode,
} from "#/types/timeline"
import { flattenNodes } from "#/types/timeline"
import { migrateNodes } from "#/lib/timeline/migrate-timeline"
import { useLocalStorage } from "./useLocalStorage"
import type { DropPosition } from "./useTimelineDrag"

type NewEntry = Omit<TimelineEntry, "id">

function transformNodes(raw: unknown): TimelineNode[] {
  return migrateNodes(Array.isArray(raw) ? raw : [])
}

export function useTimeline(onShapeChange?: () => void) {
  const [nodes, setNodes] = useLocalStorage<TimelineNode[]>(
    "wuwa.timeline.entries",
    [],
    transformNodes,
  )

  const entries = useMemo(() => flattenNodes(nodes), [nodes])

  function addEntry(entry: NewEntry) {
    setNodes((prev): TimelineNode[] => {
      const openGroupIndex = prev.findIndex(
        (n): n is TimelineGroup => n.kind === "group" && !n.locked,
      )
      if (openGroupIndex !== -1) {
        return prev.map((n, i) =>
          i === openGroupIndex && n.kind === "group"
            ? {
                ...n,
                entries: [...n.entries, { ...entry, id: crypto.randomUUID() }],
              }
            : n,
        )
      }
      return [...prev, { kind: "entry", ...entry, id: crypto.randomUUID() }]
    })
    onShapeChange?.()
  }

  function addGroup(): string {
    const id = crypto.randomUUID()
    setNodes((prev): TimelineNode[] => {
      const updated = prev.map((n) =>
        n.kind === "group" && !n.locked ? { ...n, locked: true } : n,
      )
      return [
        ...updated,
        { kind: "group", id, label: "", locked: false, entries: [] },
      ]
    })
    onShapeChange?.()
    return id
  }

  function toggleGroupLock(groupId: string) {
    setNodes((prev) => {
      const target = prev.find((n) => n.kind === "group" && n.id === groupId)
      if (!target || target.kind !== "group") return prev
      if (target.locked) {
        // Opening this group — lock all currently-open groups (at-most-one-open)
        return prev.map((n) => {
          if (n.kind !== "group") return n
          if (n.id === groupId) return { ...n, locked: false }
          return n.locked ? n : { ...n, locked: true }
        })
      }
      // Locking this group
      return prev.map((n) =>
        n.kind === "group" && n.id === groupId ? { ...n, locked: true } : n,
      )
    })
  }

  function deleteGroup(groupId: string) {
    setNodes((prev) =>
      prev.filter((n) => !(n.kind === "group" && n.id === groupId)),
    )
    onShapeChange?.()
  }

  function duplicateGroup(groupId: string) {
    setNodes((prev) => {
      const sourceIndex = prev.findIndex(
        (n) => n.kind === "group" && n.id === groupId,
      )
      if (sourceIndex === -1) return prev
      const source = prev[sourceIndex]
      if (source.kind !== "group") return prev
      const clone: TimelineGroup = {
        kind: "group",
        id: crypto.randomUUID(),
        label: source.label ? `${source.label} copy` : "copy",
        locked: source.locked ? true : true, // copy of open group is always locked
        entries: source.entries.map((e) => ({ ...e, id: crypto.randomUUID() })),
      }
      const result = [...prev]
      result.splice(sourceIndex + 1, 0, clone)
      return result
    })
    onShapeChange?.()
  }

  function removeEntry(id: string) {
    setNodes((prev) =>
      prev.flatMap<TimelineNode>((node) => {
        if (node.kind === "entry") return node.id === id ? [] : [node]
        if (node.kind !== "group") return [node]
        return [{ ...node, entries: node.entries.filter((e) => e.id !== id) }]
      }),
    )
    onShapeChange?.()
  }

  function addLoopMarker() {
    setNodes((prev): TimelineNode[] =>
      prev.some((n) => n.kind === "loopMarker")
        ? prev
        : [...prev, { kind: "loopMarker", id: crypto.randomUUID() }],
    )
    onShapeChange?.()
  }

  function removeLoopMarker() {
    setNodes((prev) => prev.filter((n) => n.kind !== "loopMarker"))
    onShapeChange?.()
  }

  function reorderEntries(
    fromId: string,
    toId: string,
    position: DropPosition,
  ) {
    setNodes((prev) => {
      const fromIndex = prev.findIndex(
        (n) => n.kind === "entry" && n.id === fromId,
      )
      const toIndex = prev.findIndex((n) => n.kind === "entry" && n.id === toId)
      if (fromIndex === -1 || toIndex === -1) return prev
      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex
      const insertAt = position === "above" ? adjustedTo : adjustedTo + 1
      next.splice(insertAt, 0, item)
      return next
    })
    onShapeChange?.()
  }

  function reorderNodes(fromId: string, toId: string, position: DropPosition) {
    setNodes((prev) => {
      const fromIndex = prev.findIndex((n) => n.id === fromId)
      const toIndex = prev.findIndex((n) => n.id === toId)
      if (fromIndex === -1 || toIndex === -1) return prev
      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex
      const insertAt = position === "above" ? adjustedTo : adjustedTo + 1
      next.splice(insertAt, 0, item)
      return next
    })
    onShapeChange?.()
  }

  function reorderGroupEntries(
    groupId: string,
    fromId: string,
    toId: string,
    position: DropPosition,
  ) {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.kind !== "group" || node.id !== groupId) return node
        const fromIndex = node.entries.findIndex((e) => e.id === fromId)
        const toIndex = node.entries.findIndex((e) => e.id === toId)
        if (fromIndex === -1 || toIndex === -1) return node
        const next = [...node.entries]
        const [item] = next.splice(fromIndex, 1)
        const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex
        const insertAt = position === "above" ? adjustedTo : adjustedTo + 1
        next.splice(insertAt, 0, item)
        return { ...node, entries: next }
      }),
    )
    onShapeChange?.()
  }

  function updateEntry(id: string, patch: Partial<Omit<TimelineEntry, "id">>) {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.kind === "entry") {
          return node.id === id ? { ...node, ...patch } : node
        }
        if (node.kind !== "group") return node
        return {
          ...node,
          entries: node.entries.map((e) =>
            e.id === id ? { ...e, ...patch } : e,
          ),
        }
      }),
    )
    if (
      "characterId" in patch ||
      "stageId" in patch ||
      "variantKind" in patch
    ) {
      onShapeChange?.()
    }
  }

  function updateGroupLabel(groupId: string, label: string) {
    setNodes((prev) =>
      prev.map((n) =>
        n.kind === "group" && n.id === groupId ? { ...n, label } : n,
      ),
    )
  }

  function clearTimeline() {
    setNodes([])
    onShapeChange?.()
  }

  function loadNodes(incoming: TimelineNode[]) {
    setNodes(incoming)
    onShapeChange?.()
  }

  return {
    nodes,
    entries,
    addEntry,
    addGroup,
    addLoopMarker,
    removeLoopMarker,
    removeEntry,
    reorderEntries,
    updateEntry,
    updateGroupLabel,
    toggleGroupLock,
    deleteGroup,
    duplicateGroup,
    reorderNodes,
    reorderGroupEntries,
    clearTimeline,
    loadNodes,
  }
}
