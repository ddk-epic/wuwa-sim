import { useState } from 'react'
import type { Slots, SlotLoadout } from '#/types/loadout'
import { CHARACTER_TEMPLATES } from '#/data/templates'
import { ALL_ECHOES } from '#/data/echoes/index'
import { ALL_ECHO_SETS } from '#/data/echo-sets/index'

const emptyLoadout = (): SlotLoadout => ({
  weaponId: null,
  echoId: null,
  echoSetId: null,
})

function loadoutFromTemplate(characterId: number): SlotLoadout {
  const template = CHARACTER_TEMPLATES.find(
    (t) => t.characterId === characterId,
  )
  return template
    ? {
        weaponId: template.weaponId,
        echoId: template.echoId,
        echoSetId: template.echoSetId,
      }
    : emptyLoadout()
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
  const [slots, setSlots] = useState<Slots>([null, null, null])
  const [loadouts, setLoadouts] = useState<
    [SlotLoadout, SlotLoadout, SlotLoadout]
  >([emptyLoadout(), emptyLoadout(), emptyLoadout()])
  const [focusedId, setFocusedId] = useState<number | null>(null)

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
      setLoadouts((prev) =>
        updateSlot(prev, nullSlot, () => loadoutFromTemplate(characterId)),
      )
      setFocusedId(characterId)
    }
  }

  function setWeapon(slotIndex: number, weaponId: number) {
    setLoadouts((prev) =>
      updateSlot(prev, slotIndex, (slot) => ({ ...slot, weaponId })),
    )
  }

  function setEcho(slotIndex: number, echoId: number) {
    const echo = ALL_ECHOES.find((e) => e.id === echoId)
    const matchingSet = echo
      ? ALL_ECHO_SETS.find((s) => s.name === echo.set)
      : null
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
    setWeapon,
    setEcho,
    setEchoSet,
  }
}
