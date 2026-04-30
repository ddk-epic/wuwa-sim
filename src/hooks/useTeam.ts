import type { Slots, SlotLoadout } from "#/types/loadout"
import { useLocalStorage } from "./useLocalStorage"
import { getCharacterById } from "#/lib/catalog"
import {
  emptyLoadout,
  inferEchoSetForEcho,
  loadoutFromTemplate,
} from "#/lib/template"

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
  >("wuwa.team.loadouts", [emptyLoadout(), emptyLoadout(), emptyLoadout()])
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

  function setWeapon(slotIndex: number, weaponId: number) {
    setLoadouts((prev) =>
      updateSlot(prev, slotIndex, (slot) => ({ ...slot, weaponId })),
    )
  }

  function setEcho(slotIndex: number, echoId: number) {
    const matchingSet = inferEchoSetForEcho(echoId)
    setLoadouts((prev) =>
      updateSlot(prev, slotIndex, (slot) => ({
        ...slot,
        echoId,
        echoSetId: matchingSet?.id ?? slot.echoSetId,
      })),
    )
  }

  function setEchoSet(slotIndex: number, echoSetId: number) {
    setLoadouts((prev) =>
      updateSlot(prev, slotIndex, (slot) => ({ ...slot, echoSetId })),
    )
  }

  return {
    slots,
    loadouts,
    focusedId,
    selectedCount: slots.filter((s) => s !== null).length,
    toggleCharacter,
    focusCharacter,
    setWeapon,
    setEcho,
    setEchoSet,
  }
}
