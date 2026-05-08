import type { TimelineEntry } from "#/types/timeline"
import { migrateEntries } from "#/lib/migrate-timeline"
import { useLocalStorage } from "./useLocalStorage"

type NewEntry = Omit<TimelineEntry, "id">

function transformEntries(raw: unknown): TimelineEntry[] {
  return migrateEntries(Array.isArray(raw) ? raw : [])
}

export function useTimeline() {
  const [entries, setEntries] = useLocalStorage<TimelineEntry[]>(
    "wuwa.timeline.entries",
    [],
    transformEntries,
  )

  function addEntry(entry: NewEntry) {
    setEntries((prev) => [...prev, { ...entry, id: crypto.randomUUID() }])
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function reorderEntries(fromId: string, toId: string) {
    setEntries((prev) => {
      const fromIndex = prev.findIndex((e) => e.id === fromId)
      const toIndex = prev.findIndex((e) => e.id === toId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex)
        return prev
      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      return next
    })
  }

  function updateEntry(id: string, patch: Partial<Omit<TimelineEntry, "id">>) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    )
  }

  function clearTimeline() {
    setEntries([])
  }

  return {
    entries,
    addEntry,
    removeEntry,
    reorderEntries,
    updateEntry,
    clearTimeline,
  }
}
