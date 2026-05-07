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
  echoSetId: null,
  sequence: 0,
})

export function loadoutFromTemplate(template: CharacterTemplate): SlotLoadout {
  const weapon = findWeaponByName(template.weapon)
  const echo = findEchoByName(template.echo)
  const echoSet = findEchoSetByName(template.echoSet)
  return {
    weaponId: weapon?.id ?? null,
    weaponRank: 1,
    echoId: echo?.id ?? null,
    echoSetId: echoSet?.id ?? null,
    sequence: 0,
  }
}

export function inferEchoSetForEcho(echoId: number): EchoSet | null {
  const echo = getEchoById(echoId)
  if (!echo) return null
  return getEchoSetForEcho(echo)
}
