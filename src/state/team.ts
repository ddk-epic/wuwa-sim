import { useEffect, useRef } from "react"
import { atom, useAtomValue, useSetAtom } from "jotai"
import { selectAtom } from "jotai/utils"
import type { ActiveTeam, Slots, SlotLoadout } from "#/types/loadout"
import type { EnrichedCharacter } from "#/types/character"
import { emptyLoadout } from "#/lib/loadout/template"
import { applySlotPatch, toggleCharacter } from "#/lib/loadout/team-ops"
import { getCharacterById } from "#/lib/loadout/catalog"
import {
  DEFAULT_SETTINGS,
  applySettingsPatch,
  coerceStoredSettings,
} from "#/lib/settings"
import type { Settings } from "#/lib/settings"

export const TEAM_KEY = "wuwa.team"

/** A fresh, empty Active Team — the default before anything is composed. */
export function defaultActiveTeam(): ActiveTeam {
  return {
    name: "New team",
    slots: [null, null, null],
    loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
    focusedId: null,
    originId: null,
    settings: { ...DEFAULT_SETTINGS },
  }
}

/** A draft starts unnamed so the create modal's dynamic placeholder shows. */
export function draftActiveTeam(): ActiveTeam {
  return { ...defaultActiveTeam(), name: "" }
}

/**
 * Coerce unknown stored JSON into an ActiveTeam, merging each loadout slot over
 * defaults (the storage boundary — older/partial objects must not crash).
 */
export function coerceStoredActiveTeam(stored: unknown): ActiveTeam {
  const base = defaultActiveTeam()
  const t = (stored ?? {}) as Partial<ActiveTeam>
  const loadouts = Array.isArray(t.loadouts) ? t.loadouts : []
  return {
    name: typeof t.name === "string" ? t.name : base.name,
    slots: Array.isArray(t.slots) ? t.slots : base.slots,
    loadouts: base.loadouts.map((def, i) => ({
      ...def,
      ...(loadouts[i] as object | undefined),
    })) as [SlotLoadout, SlotLoadout, SlotLoadout],
    focusedId: typeof t.focusedId === "number" ? t.focusedId : base.focusedId,
    originId: typeof t.originId === "string" ? t.originId : base.originId,
    settings: coerceStoredSettings(t.settings),
  }
}

/**
 * The single source of truth for the active team. A plain in-memory atom, not
 * atomWithStorage: that would bind every Jotai store (including the create
 * modal's draft `<Provider>`) to the same `wuwa.team` localStorage backing,
 * so a draft keystroke would overwrite the live session. Persistence is a
 * separate bridge mounted only at the live root — see useTeamPersistence.
 */
export const teamAtom = atom<ActiveTeam>(defaultActiveTeam())

/** Settings stay per-team, riding Save/Load and export with the rest of the team. */
export const settingsAtom = atom(
  (get) => get(teamAtom).settings,
  (_get, set, patch: Partial<Settings>) =>
    set(teamAtom, (t) => ({
      ...t,
      settings: applySettingsPatch(t.settings, patch),
    })),
)

/**
 * The slots slice. team-ops preserves the `slots` array reference across
 * unrelated changes (settings/name/focus/loadout edits), so default `Object.is`
 * equality lets slots-only consumers skip those re-renders.
 */
export const slotsAtom = selectAtom(teamAtom, (t) => t.slots)

/** The focusedId slice — a primitive, so default equality is ideal. */
export const focusedIdAtom = selectAtom(teamAtom, (t) => t.focusedId)

export const nameAtom = atom(
  (get) => get(teamAtom).name,
  (_get, set, name: string) => set(teamAtom, (t) => ({ ...t, name })),
)

export const toggleCharacterAtom = atom(
  null,
  (_get, set, characterId: number) =>
    set(teamAtom, (t) => toggleCharacter(t, characterId)),
)

export const focusCharacterAtom = atom(null, (_get, set, id: number) =>
  set(teamAtom, (t) => ({ ...t, focusedId: id })),
)

export const setOriginIdAtom = atom(
  null,
  (_get, set, originId: string | null) =>
    set(teamAtom, (t) => ({ ...t, originId })),
)

/** An imported/loaded team is unsaved — it has no Library Origin until a Save. */
export const loadTeamAtom = atom(
  null,
  (
    _get,
    set,
    next: {
      slots: Slots
      loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
      focusedId: number | null
      settings?: Settings
    },
  ) =>
    set(teamAtom, (t) => ({
      ...t,
      slots: next.slots,
      loadouts: next.loadouts,
      focusedId: next.focusedId,
      originId: null,
      settings: coerceStoredSettings(next.settings ?? DEFAULT_SETTINGS),
    })),
)

interface SlotData {
  charId: number | null
  loadout: SlotLoadout
}

/**
 * One selector per slot: each slot's character id + loadout, selected from
 * teamAtom with a reference equality that holds whenever that slot is untouched
 * (team-ops keeps other slots' loadout objects by reference). A settings change
 * or an edit to a different slot then yields the same selected value, so this
 * slot's consumers skip the re-render. Keys are the fixed slot indices, so a
 * static array suffices.
 */
const slotSelectors = [0, 1, 2].map((i) =>
  selectAtom(
    teamAtom,
    (team): SlotData => ({ charId: team.slots[i], loadout: team.loadouts[i] }),
    (a, b) => a.charId === b.charId && a.loadout === b.loadout,
  ),
)

export interface SlotView {
  character: EnrichedCharacter | null
  loadout: SlotLoadout
  setPatch: (patch: Partial<SlotLoadout>) => void
}

export function useSlot(i: number): SlotView {
  const { charId, loadout } = useAtomValue(slotSelectors[i])
  const setTeam = useSetAtom(teamAtom)
  return {
    character: charId !== null ? getCharacterById(charId) : null,
    loadout,
    setPatch: (patch) => setTeam((t) => applySlotPatch(t, i, patch)),
  }
}

/**
 * Bridges the live teamAtom to its `wuwa.team` localStorage backing: hydrates
 * once on mount (coercing legacy/partial objects), then persists every change.
 * Mounted only at the live root, never inside the draft `<Provider>`, so the
 * draft store carries no persistence and stays fully isolated.
 */
export function useTeamPersistence(): void {
  const team = useAtomValue(teamAtom)
  const setTeam = useSetAtom(teamAtom)
  const hydrated = useRef(false)

  // Hydrate once on mount, persist on later runs — one effect so mount never
  // writes the pre-hydration team back over what was just stored.
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      try {
        const raw = window.localStorage.getItem(TEAM_KEY)
        if (raw !== null) setTeam(coerceStoredActiveTeam(JSON.parse(raw)))
      } catch {
        // silently ignore read errors
      }
      return
    }
    try {
      window.localStorage.setItem(TEAM_KEY, JSON.stringify(team))
    } catch {
      // silently ignore write errors
    }
  }, [team, setTeam])
}
