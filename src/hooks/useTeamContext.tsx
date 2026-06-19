import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import type { EnrichedCharacter } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { Settings } from "#/lib/settings"
import { getCharacterById } from "#/lib/loadout/catalog"

export interface TeamContextValue {
  name: string
  slots: Slots
  loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
  focusedId: number | null
  selectedCount: number
  /** Present under the live `useTeam` provider; the in-memory draft omits it. */
  settings?: Settings
  setName: (name: string) => void
  toggleCharacter: (characterId: number) => void
  focusCharacter: (id: number) => void
  setSlotPatch: (slotIndex: number, patch: Partial<SlotLoadout>) => void
}

const TeamContext = createContext<TeamContextValue | null>(null)

export function TeamProvider({
  value,
  children,
}: {
  value: TeamContextValue
  children: ReactNode
}) {
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}

export function useTeamContext(): TeamContextValue {
  const ctx = useContext(TeamContext)
  if (!ctx) {
    throw new Error("Team hook must be used within a TeamProvider")
  }
  return ctx
}

export interface SlotView {
  character: EnrichedCharacter | null
  loadout: SlotLoadout
  setPatch: (patch: Partial<SlotLoadout>) => void
}

export function useSlot(i: number): SlotView {
  const { slots, loadouts, setSlotPatch } = useTeamContext()
  const charId = slots[i]
  const character = charId !== null ? getCharacterById(charId) : null
  return {
    character,
    loadout: loadouts[i],
    setPatch: (patch) => setSlotPatch(i, patch),
  }
}
