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
  echoId: null,
  echoSetId: null,
})

export function loadoutFromTemplate(template: CharacterTemplate): SlotLoadout {
  const weapon = findWeaponByName(template.weapon)
  const echo = findEchoByName(template.echo)
  const echoSet = findEchoSetByName(template.echoSet)
  return {
    weaponId: weapon?.id ?? null,
    echoId: echo?.id ?? null,
    echoSetId: echoSet?.id ?? null,
  }
}

export function inferEchoSetForEcho(echoId: number): EchoSet | null {
  const echo = getEchoById(echoId)
  if (!echo) return null
  return getEchoSetForEcho(echo)
}
