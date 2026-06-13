import { useLocalStorage } from "./useLocalStorage"
import { decodePayload } from "#/lib/import-export"
import type { ImportExportPayload } from "#/lib/import-export"
import { computeTeamStats } from "#/lib/team-stats"
import type { TeamStats } from "#/lib/team-stats"
import { defaultActiveTeam, reviveActiveTeam, TEAM_KEY } from "./useTeam"
import { LOG_KEY, normalizeStoredLog } from "./useSimulationLog"
import type { ActiveTeam } from "#/types/loadout"
import type { TimelineNode } from "#/types/timeline"
import { reviveSettings } from "#/lib/settings"

/**
 * One saved team in the Library. `payload` reuses the import/export bundle as the
 * per-entry unit; `stats` is a snapshot taken at save time (no signature / no
 * auto-refresh — a fresh snapshot only lands on the next simulator Save).
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
  team: TEAM_KEY,
  timeline: "wuwa.timeline.entries",
  log: LOG_KEY,
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

/**
 * Snapshot the live `wuwa.*` keys into a payload + stats + name (read-only on
 * the live state). `originId` is live-only identity and does not travel in the
 * portable payload.
 */
function snapshotLive(): {
  payload: ImportExportPayload
  stats: TeamStats
  name: string
} {
  const team = reviveActiveTeam(
    readJSON<unknown>(LIVE.team, defaultActiveTeam()),
  )
  const nodes = readJSON<TimelineNode[]>(LIVE.timeline, [])
  // wuwa.simulation-log holds a { log, signature } object (a bare array only on
  // a cleared/legacy write) — normalize before computing stats.
  const { log } = normalizeStoredLog(readJSON<unknown>(LIVE.log, []))
  return {
    payload: {
      team: {
        name: team.name,
        slots: team.slots,
        loadouts: team.loadouts,
        focusedId: team.focusedId,
        settings: team.settings,
      },
      timeline: nodes.length > 0 ? nodes : null,
    },
    stats: computeTeamStats(log),
    name: team.name,
  }
}

/**
 * Write a payload + name back into the consolidated live team object, clearing
 * the stale log so /sim re-simulates. `originId` records which Saved Team this
 * Session was loaded from (`null` for a fresh/imported team).
 */
function writeLive(
  payload: ImportExportPayload,
  name: string,
  originId: string | null,
): void {
  const team: ActiveTeam = {
    name,
    slots: payload.team.slots,
    loadouts: payload.team.loadouts,
    focusedId: payload.team.focusedId,
    originId,
    settings: reviveSettings(payload.team.settings),
  }
  writeJSON(LIVE.team, team)
  writeJSON(LIVE.timeline, payload.timeline ?? [])
  writeJSON(LIVE.log, [])
}

/**
 * Push an in-memory draft (the Library create flow) into the live Session with a
 * `null` Origin and a cleared timeline/log. Not a hook — it only writes the live
 * keys, which the simulator re-reads on mount; the caller then navigates to /sim.
 */
export function moveDraftToLive(draft: {
  name: string
  slots: ActiveTeam["slots"]
  loadouts: ActiveTeam["loadouts"]
  focusedId: ActiveTeam["focusedId"]
}): void {
  writeLive(
    {
      team: {
        name: draft.name,
        slots: draft.slots,
        loadouts: draft.loadouts,
        focusedId: draft.focusedId,
      },
      timeline: null,
    },
    draft.name,
    null,
  )
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

  /**
   * Overwrite an existing entry's payload + stats + name + `updated`, keeping its
   * `id` and `pinned` flag. Falls back to creating a fresh entry when `id` is not
   * found (so a Save against a dangling Origin can never silently no-op).
   */
  function updateTeam(
    id: string,
    name: string,
    payload: ImportExportPayload,
    stats: TeamStats,
  ): void {
    setTeams((prev) => {
      if (!prev.some((t) => t.id === id)) {
        return [...prev, newTeam(name, payload, stats)]
      }
      return prev.map((t) =>
        t.id === id ? { ...t, name, payload, stats, updated: Date.now() } : t,
      )
    })
  }

  /**
   * Save the live active team back to the Library — **update-or-create** keyed on
   * the Session's `originId`. When `originId` names a still-existing entry it is
   * updated in place; otherwise (null Origin, or a dangling id) a fresh entry is
   * created. Returns the id the team was saved to, so the caller can re-stamp the
   * live `originId` after a create.
   */
  function saveCurrent(originId: string | null): string {
    const { payload, stats, name } = snapshotLive()
    if (originId !== null && teams.some((t) => t.id === originId)) {
      updateTeam(originId, name, payload, stats)
      return originId
    }
    const created = newTeam(name, payload, stats)
    setTeams((prev) => [...prev, created])
    return created.id
  }

  /**
   * Write a saved team's payload + name into the live keys and stamp its id as
   * the live Session's Origin (caller navigates to /sim).
   */
  function load(id: string): void {
    const team = teams.find((t) => t.id === id)
    if (team) writeLive(team.payload, team.name, id)
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
    // Restore the bundled name; fall back to a placeholder only when it's empty
    // (e.g. a v1 code, which carried no name). No log travels in a bundle, so
    // stats start empty until the team is loaded + re-run.
    const name = payload.team.name.trim() || "Imported team"
    setTeams((prev) => [...prev, newTeam(name, payload, computeTeamStats([]))])
    return true
  }

  return {
    teams,
    saveCurrent,
    updateTeam,
    load,
    rename,
    togglePin,
    duplicate,
    remove,
    importBundle,
  }
}
