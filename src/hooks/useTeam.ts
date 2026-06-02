import type { ActiveTeam, Slots, SlotLoadout } from "#/types/loadout"
import { useLocalStorage } from "./useLocalStorage"
import { emptyLoadout } from "#/lib/loadout/template"
import { applySlotPatch, toggleCharacter } from "#/lib/loadout/team-ops"

export const TEAM_KEY = "wuwa.team"

/** A fresh, empty Active Team — the default before anything is composed. */
export function defaultActiveTeam(): ActiveTeam {
  return {
    name: "New team",
    slots: [null, null, null],
    loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
    focusedId: null,
    originId: null,
  }
}

/**
 * Coerce unknown stored JSON into an ActiveTeam, merging each loadout slot over
 * defaults (the storage boundary — older/partial objects must not crash).
 */
export function reviveActiveTeam(stored: unknown): ActiveTeam {
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
  }
}

export function useTeam() {
  const [team, setTeam] = useLocalStorage<ActiveTeam>(
    TEAM_KEY,
    defaultActiveTeam(),
    reviveActiveTeam,
  )
  const { name, slots, loadouts, focusedId, originId } = team

  // Per-field setters patch the single consolidated object; the composition
  // rules live in the shared team-ops transforms.
  function setName(next: string) {
    setTeam((prev) => ({ ...prev, name: next }))
  }
  function setOriginId(next: string | null) {
    setTeam((prev) => ({ ...prev, originId: next }))
  }
  function toggleCharacterFn(characterId: number) {
    setTeam((prev) => toggleCharacter(prev, characterId))
  }
  function focusCharacter(id: number) {
    setTeam((prev) => ({ ...prev, focusedId: id }))
  }
  function setSlotPatch(slotIndex: number, patch: Partial<SlotLoadout>) {
    setTeam((prev) => applySlotPatch(prev, slotIndex, patch))
  }

  function loadTeam(
    newSlots: Slots,
    newLoadouts: [SlotLoadout, SlotLoadout, SlotLoadout],
    newFocusedId: number | null,
  ) {
    // An imported team is unsaved — it has no Library Origin until a Save.
    setTeam((prev) => ({
      ...prev,
      slots: newSlots,
      loadouts: newLoadouts,
      focusedId: newFocusedId,
      originId: null,
    }))
  }

  return {
    name,
    slots,
    loadouts,
    focusedId,
    originId,
    selectedCount: slots.filter((s) => s !== null).length,
    setName,
    setOriginId,
    toggleCharacter: toggleCharacterFn,
    focusCharacter,
    setSlotPatch,
    loadTeam,
  }
}
