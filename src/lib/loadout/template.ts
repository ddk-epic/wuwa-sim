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
import { DEFAULT_ECHO_BUILD, ECHO_BUILDS } from "./echo-stat-constants"

export const emptyLoadout = (): SlotLoadout => ({
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
  echoBuild: DEFAULT_ECHO_BUILD,
  cost4Mains: [...ECHO_BUILDS[DEFAULT_ECHO_BUILD].cost4Default],
  cost3Mains: [...ECHO_BUILDS[DEFAULT_ECHO_BUILD].cost3Default],
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
    echoBuild: DEFAULT_ECHO_BUILD,
    cost4Mains: [...ECHO_BUILDS[DEFAULT_ECHO_BUILD].cost4Default],
    cost3Mains: [...ECHO_BUILDS[DEFAULT_ECHO_BUILD].cost3Default],
  }
}

export function inferEchoSetForEcho(echoId: number): EchoSet | null {
  const echo = getEchoById(echoId)
  if (!echo) return null
  return getEchoSetForEcho(echo)
}
