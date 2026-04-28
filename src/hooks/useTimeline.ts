import { useState } from 'react'
import type { TimelineEntry } from '#/types/timeline'

type NewEntry = Omit<TimelineEntry, 'id'>

export function useTimeline() {
  const [entries, setEntries] = useState<TimelineEntry[]>([])

  function addEntry(entry: NewEntry) {
    setEntries((prev) => [...prev, { ...entry, id: crypto.randomUUID() }])
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function clearTimeline() {
    setEntries([])
  }

  return { entries, addEntry, removeEntry, clearTimeline }
}
