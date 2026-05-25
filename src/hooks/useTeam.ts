import type { Slots, SlotLoadout } from "#/types/loadout"
import { useLocalStorage } from "./useLocalStorage"
import { getCharacterById, getEchoSetById } from "#/lib/loadout/catalog"
import {
  emptyLoadout,
  inferEchoSetForEcho,
  loadoutFromTemplate,
} from "#/lib/loadout/template"

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
  const [slots, setSlots] = useLocalStorage<Slots>("wuwa.team.slots", [
    null,
    null,
    null,
  ])
  const [loadouts, setLoadouts] = useLocalStorage<
    [SlotLoadout, SlotLoadout, SlotLoadout]
  >(
    "wuwa.team.loadouts",
    [emptyLoadout(), emptyLoadout(), emptyLoadout()],
    (stored) => {
      const arr = stored as [unknown, unknown, unknown]
      return arr.map((s) => ({
        ...emptyLoadout(),
        ...(s as object),
      })) as [SlotLoadout, SlotLoadout, SlotLoadout]
    },
  )
  const [focusedId, setFocusedId] = useLocalStorage<number | null>(
    "wuwa.team.focusedId",
    null,
  )

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
    setSlots(newSlots)
    setLoadouts(newLoadouts)
    setFocusedId(newFocusedId)
  }

  return {
    slots,
    loadouts,
    focusedId,
    selectedCount: slots.filter((s) => s !== null).length,
    toggleCharacter,
    focusCharacter,
    setSlotPatch,
    loadTeam,
  }
}
