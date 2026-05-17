import type {
  TimelineEntry,
  TimelineGroup,
  TimelineNode,
} from "#/types/timeline"
import { flattenNodes } from "#/types/timeline"
import { migrateNodes } from "#/lib/migrate-timeline"
import { useLocalStorage } from "./useLocalStorage"

type NewEntry = Omit<TimelineEntry, "id">

function transformNodes(raw: unknown): TimelineNode[] {
  return migrateNodes(Array.isArray(raw) ? raw : [])
}

export function useTimeline() {
  const [nodes, setNodes] = useLocalStorage<TimelineNode[]>(
    "wuwa.timeline.entries",
    [],
    transformNodes,
  )

  const entries = flattenNodes(nodes)

  function addEntry(entry: NewEntry) {
    setNodes((prev) => {
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
      return [
        ...prev,
        { kind: "entry" as const, ...entry, id: crypto.randomUUID() },
      ]
    })
  }

  function addGroup(): string {
    const id = crypto.randomUUID()
    setNodes((prev) => [
      ...prev,
      { kind: "group" as const, id, label: "", locked: false, entries: [] },
    ])
    return id
  }

  function removeEntry(id: string) {
    setNodes((prev) =>
      prev.flatMap((node) => {
        if (node.kind === "entry") return node.id === id ? [] : [node]
        return [{ ...node, entries: node.entries.filter((e) => e.id !== id) }]
      }),
    )
  }

  function reorderEntries(fromId: string, toId: string) {
    setNodes((prev) => {
      const fromIndex = prev.findIndex(
        (n) => n.kind === "entry" && n.id === fromId,
      )
      const toIndex = prev.findIndex((n) => n.kind === "entry" && n.id === toId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex)
        return prev
      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      return next
    })
  }

  function updateEntry(id: string, patch: Partial<Omit<TimelineEntry, "id">>) {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.kind === "entry") {
          return node.id === id ? { ...node, ...patch } : node
        }
        return {
          ...node,
          entries: node.entries.map((e) =>
            e.id === id ? { ...e, ...patch } : e,
          ),
        }
      }),
    )
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
  }

  return {
    nodes,
    entries,
    addEntry,
    addGroup,
    removeEntry,
    reorderEntries,
    updateEntry,
    updateGroupLabel,
    clearTimeline,
  }
}
