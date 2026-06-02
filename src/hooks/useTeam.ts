import type { ActiveTeam, Slots, SlotLoadout } from "#/types/loadout"
import { useLocalStorage } from "./useLocalStorage"
import { getCharacterById, getEchoSetById } from "#/lib/loadout/catalog"
import {
  emptyLoadout,
  inferEchoSetForEcho,
  loadoutFromTemplate,
} from "#/lib/loadout/template"

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

function updateSlot(
  prev: [SlotLoadout, SlotLoadout, SlotLoadout],
  index: number,
  updater: (slot: SlotLoadout) => SlotLoadout,
): [SlotLoadout, SlotLoadout, SlotLoadout] {
  const next: [SlotLoadout, SlotLoadout, SlotLoadout] = [
    prev[0],
    prev[1],
    prev[2],
  ]
  next[index] = updater(next[index])
  return next
}

export function useTeam() {
  const [team, setTeam] = useLocalStorage<ActiveTeam>(
    TEAM_KEY,
    defaultActiveTeam(),
    reviveActiveTeam,
  )
  const { name, slots, loadouts, focusedId } = team

  // Per-field setters patch the single consolidated object.
  function setSlots(next: Slots) {
    setTeam((prev) => ({ ...prev, slots: next }))
  }
  function setLoadouts(
    updater: (
      prev: [SlotLoadout, SlotLoadout, SlotLoadout],
    ) => [SlotLoadout, SlotLoadout, SlotLoadout],
  ) {
    setTeam((prev) => ({ ...prev, loadouts: updater(prev.loadouts) }))
  }
  function setFocusedId(next: number | null) {
    setTeam((prev) => ({ ...prev, focusedId: next }))
  }
  function setName(next: string) {
    setTeam((prev) => ({ ...prev, name: next }))
  }

  function toggleCharacter(characterId: number) {
    const slotIndex = slots.indexOf(characterId)
    if (slotIndex !== -1) {
      const newSlots: Slots = [slots[0], slots[1], slots[2]]
      newSlots[slotIndex] = null
      setSlots(newSlots)
      setLoadouts((prev) => updateSlot(prev, slotIndex, emptyLoadout))
      if (focusedId === characterId) {
        const others = newSlots.filter((id): id is number => id !== null)
        setFocusedId(others.length > 0 ? others[others.length - 1] : null)
      }
    } else {
      const nullSlot = slots.indexOf(null)
      if (nullSlot === -1) return
      const newSlots: Slots = [slots[0], slots[1], slots[2]]
      newSlots[nullSlot] = characterId
      setSlots(newSlots)
      const character = getCharacterById(characterId)
      const newLoadout = character
        ? loadoutFromTemplate(character.template)
        : emptyLoadout()
      setLoadouts((prev) => updateSlot(prev, nullSlot, () => newLoadout))
      setFocusedId(characterId)
    }
  }

  function focusCharacter(id: number) {
    setFocusedId(id)
  }

  function setSlotPatch(slotIndex: number, patch: Partial<SlotLoadout>) {
    if ("echoId" in patch && patch.echoId != null) {
      const matchingSet = inferEchoSetForEcho(patch.echoId)
      const setId = matchingSet?.id ?? null
      setLoadouts((prev) => {
        const slot = prev[slotIndex]
        const autoFillSlot2 =
          setId !== null &&
          matchingSet?.type === "two-five" &&
          slot.echoSetSlot2Id === null
        return updateSlot(prev, slotIndex, (s) => ({
          ...s,
          ...patch,
          echoSetSlot1Id: setId ?? s.echoSetSlot1Id,
          echoSetSlot2Id: autoFillSlot2 ? setId : s.echoSetSlot2Id,
        }))
      })
    } else if ("echoSetSlot1Id" in patch) {
      const newId = patch.echoSetSlot1Id ?? null
      setLoadouts((prev) => {
        const slot = prev[slotIndex]
        const set = newId !== null ? getEchoSetById(newId) : null
        const autoFill =
          newId !== null &&
          set?.type === "two-five" &&
          slot.echoSetSlot2Id === null
        return updateSlot(prev, slotIndex, (s) => ({
          ...s,
          ...patch,
          echoSetSlot2Id: autoFill ? newId : s.echoSetSlot2Id,
        }))
      })
    } else if ("echoSetSlot2Id" in patch) {
      const newId = patch.echoSetSlot2Id ?? null
      setLoadouts((prev) => {
        const slot = prev[slotIndex]
        const set = newId !== null ? getEchoSetById(newId) : null
        const autoFill =
          newId !== null &&
          set?.type === "two-five" &&
          slot.echoSetSlot1Id === null
        return updateSlot(prev, slotIndex, (s) => ({
          ...s,
          ...patch,
          echoSetSlot1Id: autoFill ? newId : s.echoSetSlot1Id,
        }))
      })
    } else if ("weaponId" in patch) {
      setLoadouts((prev) =>
        updateSlot(prev, slotIndex, (slot) => ({
          ...slot,
          ...patch,
          weaponRank: 1,
        })),
      )
    } else {
      setLoadouts((prev) =>
        updateSlot(prev, slotIndex, (slot) => ({ ...slot, ...patch })),
      )
    }
  }

  function loadTeam(
    newSlots: Slots,
    newLoadouts: [SlotLoadout, SlotLoadout, SlotLoadout],
    newFocusedId: number | null,
  ) {
    setTeam((prev) => ({
      ...prev,
      slots: newSlots,
      loadouts: newLoadouts,
      focusedId: newFocusedId,
    }))
  }

  return {
    name,
    slots,
    loadouts,
    focusedId,
    selectedCount: slots.filter((s) => s !== null).length,
    setName,
    toggleCharacter,
    focusCharacter,
    setSlotPatch,
    loadTeam,
  }
}
