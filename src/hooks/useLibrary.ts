import { useLocalStorage } from "./useLocalStorage"
import { decodePayload } from "#/lib/import-export"
import type { ImportExportPayload } from "#/lib/import-export"
import { computeTeamStats } from "#/lib/team-stats"
import type { TeamStats } from "#/lib/team-stats"
import { emptyLoadout } from "#/lib/loadout/template"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { SimulationLogEntry } from "#/types/simulation-log"
import type { TimelineNode } from "#/types/timeline"

/**
 * One saved team in the Library. `payload` reuses the import/export bundle as the
 * per-entry unit; `stats` is a snapshot taken at save time (no signature / no
 * re-stale in v1 — refresh is manual).
 */
export interface SavedTeam {
  id: string
  name: string
  /** Epoch ms of the last write to this entry. */
  updated: number
  pinned: boolean
  payload: ImportExportPayload
  stats: TeamStats
}

const LIBRARY_KEY = "wuwa.library"

/** The live simulator keys a save snapshots from / a load writes back to. */
const LIVE = {
  slots: "wuwa.team.slots",
  loadouts: "wuwa.team.loadouts",
  focusedId: "wuwa.team.focusedId",
  timeline: "wuwa.timeline.entries",
  log: "wuwa.simulation-log",
} as const

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // silently ignore write errors (quota, private mode)
  }
}

/** Snapshot the live `wuwa.*` keys into a payload + stats (read-only on the live state). */
function snapshotLive(): { payload: ImportExportPayload; stats: TeamStats } {
  const slots = readJSON<Slots>(LIVE.slots, [null, null, null])
  const loadouts = readJSON<[SlotLoadout, SlotLoadout, SlotLoadout]>(
    LIVE.loadouts,
    [emptyLoadout(), emptyLoadout(), emptyLoadout()],
  )
  const focusedId = readJSON<number | null>(LIVE.focusedId, null)
  const nodes = readJSON<TimelineNode[]>(LIVE.timeline, [])
  const log = readJSON<SimulationLogEntry[]>(LIVE.log, [])
  return {
    payload: {
      team: { slots, loadouts, focusedId },
      timeline: nodes.length > 0 ? nodes : null,
    },
    stats: computeTeamStats(log),
  }
}

/** Write a payload back into the live keys, clearing the stale log so /sim re-simulates. */
function writeLive(payload: ImportExportPayload): void {
  writeJSON(LIVE.slots, payload.team.slots)
  writeJSON(LIVE.loadouts, payload.team.loadouts)
  writeJSON(LIVE.focusedId, payload.team.focusedId)
  writeJSON(LIVE.timeline, payload.timeline ?? [])
  writeJSON(LIVE.log, [])
}

function newTeam(
  name: string,
  payload: ImportExportPayload,
  stats: TeamStats,
): SavedTeam {
  return {
    id: crypto.randomUUID(),
    name,
    updated: Date.now(),
    pinned: false,
    payload,
    stats,
  }
}

/**
 * localStorage-backed CRUD over the Library (`wuwa.library`). No app-level
 * providers: `saveCurrent`/`load` read and write the live `wuwa.*` keys directly,
 * so the simulator (`__root`/`SimulatorPage`) is untouched and re-reads on mount.
 */
export function useLibrary() {
  const [teams, setTeams] = useLocalStorage<SavedTeam[]>(LIBRARY_KEY, [])

  /** Snapshot the live active team into a NEW SavedTeam (always creates, never updates). */
  function saveCurrent(name: string): void {
    const { payload, stats } = snapshotLive()
    setTeams((prev) => [...prev, newTeam(name, payload, stats)])
  }

  /** Write a saved team's payload into the live keys (caller navigates to /sim). */
  function load(id: string): void {
    const team = teams.find((t) => t.id === id)
    if (team) writeLive(team.payload)
  }

  function rename(id: string, name: string): void {
    setTeams((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name, updated: Date.now() } : t)),
    )
  }

  function togglePin(id: string): void {
    setTeams((prev) =>
      prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
    )
  }

  function duplicate(id: string): void {
    setTeams((prev) => {
      const team = prev.find((t) => t.id === id)
      if (!team) return prev
      return [
        ...prev,
        {
          ...team,
          id: crypto.randomUUID(),
          name: `${team.name} (copy)`,
          updated: Date.now(),
          pinned: false,
        },
      ]
    })
  }

  function remove(id: string): void {
    setTeams((prev) => prev.filter((t) => t.id !== id))
  }

  /** Parse an export code into a new SavedTeam. Returns false on invalid input. */
  function importBundle(code: string): boolean {
    let payload: ImportExportPayload
    try {
      payload = decodePayload(code)
    } catch {
      return false
    }
    // No log travels in a bundle, so stats start empty until the team is loaded + re-run.
    setTeams((prev) => [
      ...prev,
      newTeam("Imported team", payload, computeTeamStats([])),
    ])
    return true
  }

  return {
    teams,
    saveCurrent,
    load,
    rename,
    togglePin,
    duplicate,
    remove,
    importBundle,
  }
}
