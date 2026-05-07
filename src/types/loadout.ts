export type Slots = [number | null, number | null, number | null]

export interface SlotLoadout {
  weaponId: number | null
  weaponRank: number
  echoId: number | null
  echoSetId: number | null
  sequence: number
}
