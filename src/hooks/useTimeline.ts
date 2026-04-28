import type { TimelineEntry } from '#/types/timeline'
import { useLocalStorage } from './useLocalStorage'

type NewEntry = Omit<TimelineEntry, 'id'>

export function useTimeline() {
  const [entries, setEntries] = useLocalStorage<TimelineEntry[]>(
    'wuwa.timeline.entries',
    [],
  )

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
