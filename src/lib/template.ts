import type { CharacterTemplate } from "#/types/character"
import type { EchoSet } from "#/types/echo"
import type { SlotLoadout } from "#/types/loadout"
import {
  findEchoByName,
  findEchoSetByName,
  findWeaponByName,
  getEchoById,
  getEchoSetForEcho,
} from "./catalog"

export const emptyLoadout = (): SlotLoadout => ({
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
  echoBuild: "4-3-3-1-1",
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
  }
}

export function inferEchoSetForEcho(echoId: number): EchoSet | null {
  const echo = getEchoById(echoId)
  if (!echo) return null
  return getEchoSetForEcho(echo)
}
