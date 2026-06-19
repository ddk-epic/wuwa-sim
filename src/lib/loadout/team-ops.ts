import type { Slots, SlotLoadout } from "#/types/loadout"
import { getCharacterById, getEchoSetById } from "#/lib/loadout/catalog"
import {
  emptyLoadout,
  inferEchoSetForEcho,
  loadoutFromTemplate,
} from "#/lib/loadout/template"

/**
 * The composition slice shared by the live Active Team and the in-memory draft.
 * The pure transforms below operate on any object carrying these fields and
 * return a new object of the same shape, so the live team and the create
 * modal's draft store share one source of truth for the rules.
 */
export interface TeamComposition {
  slots: Slots
  loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
  focusedId: number | null
}

/** The suggested team name from the first occupied slot — the create modal's placeholder + commit fallback. */
export function suggestedTeamName(slots: Slots): string {
  const firstId = slots.find((id): id is number => id !== null)
  const char = firstId != null ? getCharacterById(firstId) : null
  return char ? `${char.name}'s Team` : "New team"
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

/** Add the character to the first free slot, or remove it if already present. */
export function toggleCharacter<T extends TeamComposition>(
  team: T,
  characterId: number,
): T {
  const { slots, loadouts, focusedId } = team
  const slotIndex = slots.indexOf(characterId)
  if (slotIndex !== -1) {
    const newSlots: Slots = [slots[0], slots[1], slots[2]]
    newSlots[slotIndex] = null
    let newFocusedId = focusedId
    if (focusedId === characterId) {
      const others = newSlots.filter((id): id is number => id !== null)
      newFocusedId = others.length > 0 ? others[others.length - 1] : null
    }
    return {
      ...team,
      slots: newSlots,
      loadouts: updateSlot(loadouts, slotIndex, emptyLoadout),
      focusedId: newFocusedId,
    }
  }
  const nullSlot = slots.indexOf(null)
  if (nullSlot === -1) return team
  const newSlots: Slots = [slots[0], slots[1], slots[2]]
  newSlots[nullSlot] = characterId
  const character = getCharacterById(characterId)
  const newLoadout = character
    ? loadoutFromTemplate(character.template)
    : emptyLoadout()
  return {
    ...team,
    slots: newSlots,
    loadouts: updateSlot(loadouts, nullSlot, () => newLoadout),
    focusedId: characterId,
  }
}

/** Apply a partial loadout patch to one slot, honoring the echo-set inference rules. */
export function applySlotPatch<T extends TeamComposition>(
  team: T,
  slotIndex: number,
  patch: Partial<SlotLoadout>,
): T {
  const { loadouts } = team
  let newLoadouts: [SlotLoadout, SlotLoadout, SlotLoadout]

  if ("echoId" in patch && patch.echoId != null) {
    const matchingSet = inferEchoSetForEcho(patch.echoId)
    const setId = matchingSet?.id ?? null
    const slot = loadouts[slotIndex]
    const autoFillSlot2 =
      setId !== null &&
      matchingSet?.type === "two-five" &&
      slot.echoSetSlot2Id === null
    newLoadouts = updateSlot(loadouts, slotIndex, (s) => ({
      ...s,
      ...patch,
      echoSetSlot1Id: setId ?? s.echoSetSlot1Id,
      echoSetSlot2Id: autoFillSlot2 ? setId : s.echoSetSlot2Id,
    }))
  } else if ("echoSetSlot1Id" in patch) {
    const newId = patch.echoSetSlot1Id ?? null
    const slot = loadouts[slotIndex]
    const set = newId !== null ? getEchoSetById(newId) : null
    const autoFill =
      newId !== null && set?.type === "two-five" && slot.echoSetSlot2Id === null
    newLoadouts = updateSlot(loadouts, slotIndex, (s) => ({
      ...s,
      ...patch,
      echoSetSlot2Id: autoFill ? newId : s.echoSetSlot2Id,
    }))
  } else if ("echoSetSlot2Id" in patch) {
    const newId = patch.echoSetSlot2Id ?? null
    const slot = loadouts[slotIndex]
    const set = newId !== null ? getEchoSetById(newId) : null
    const autoFill =
      newId !== null && set?.type === "two-five" && slot.echoSetSlot1Id === null
    newLoadouts = updateSlot(loadouts, slotIndex, (s) => ({
      ...s,
      ...patch,
      echoSetSlot1Id: autoFill ? newId : s.echoSetSlot1Id,
    }))
  } else if ("weaponId" in patch) {
    newLoadouts = updateSlot(loadouts, slotIndex, (slot) => ({
      ...slot,
      ...patch,
      weaponRank: 1,
    }))
  } else {
    newLoadouts = updateSlot(loadouts, slotIndex, (slot) => ({
      ...slot,
      ...patch,
    }))
  }

  return { ...team, loadouts: newLoadouts }
}
