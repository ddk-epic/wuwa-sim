export type Slots = [number | null, number | null, number | null]

export type EchoBuild = "4-3-3-1-1" | "4-4-1-1-1"

export type Cost4Main = "scaling" | "cr" | "cd"

export type Cost3Main = "scaling" | "er" | "elemDmg"

export interface SlotLoadout {
  weaponId: number | null
  weaponRank: number
  echoId: number | null
  echoSetSlot1Id: number | null
  echoSetSlot2Id: number | null
  sequence: number
  echoBuild: EchoBuild
  cost4Mains: Cost4Main[]
  cost3Mains: Cost3Main[]
}

/**
 * The live working team — one consolidated `wuwa.team` object. Carries its
 * Library label (`name`) and its Origin (`originId`: the Saved Team it was
 * loaded from, or `null` when unsaved). `wuwa.timeline.entries` /
 * `wuwa.simulation-log` stay separate keys (different lifecycles).
 */
export interface ActiveTeam {
  name: string
  slots: Slots
  loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
  focusedId: number | null
  originId: string | null
}
