export type Slots = [number | null, number | null, number | null]

export interface SlotLoadout {
  weaponId: number | null
  weaponRank: number
  echoId: number | null
  echoSetSlot1Id: number | null
  echoSetSlot2Id: number | null
  sequence: number
}
