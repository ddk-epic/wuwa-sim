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
