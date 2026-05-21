import type { CharacterTemplate } from "#/types/character"
import type { EchoSet } from "#/types/echo"
import type {
  Cost3Main,
  Cost4Main,
  EchoBuild,
  SlotLoadout,
} from "#/types/loadout"
import {
  findEchoByName,
  findEchoSetByName,
  findWeaponByName,
  getEchoById,
  getEchoSetForEcho,
} from "./catalog"

export const COST4_MAINS_DEFAULT: Record<EchoBuild, Cost4Main[]> = {
  "4-3-3-1-1": ["cd"],
  "4-4-1-1-1": ["cr", "cd"],
}

export const COST3_MAINS_DEFAULT: Record<EchoBuild, Cost3Main[]> = {
  "4-3-3-1-1": ["elemDmg", "elemDmg"],
  "4-4-1-1-1": [],
}

export const emptyLoadout = (): SlotLoadout => ({
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
  echoBuild: "4-3-3-1-1",
  cost4Mains: ["cd"],
  cost3Mains: ["elemDmg", "elemDmg"],
})

export function loadoutFromTemplate(template: CharacterTemplate): SlotLoadout {
  const weapon = findWeaponByName(template.weapon)
  const echo = findEchoByName(template.echo)
  const echoSet = findEchoSetByName(template.echoSet)
  const setId = echoSet?.id ?? null
  return {
    weaponId: weapon?.id ?? null,
    weaponRank: 1,
    echoId: echo?.id ?? null,
    echoSetSlot1Id: setId,
    echoSetSlot2Id: echoSet?.type === "two-five" ? setId : null,
    sequence: 0,
    echoBuild: "4-3-3-1-1",
    cost4Mains: ["cd"],
    cost3Mains: ["elemDmg", "elemDmg"],
  }
}

export function inferEchoSetForEcho(echoId: number): EchoSet | null {
  const echo = getEchoById(echoId)
  if (!echo) return null
  return getEchoSetForEcho(echo)
}
