import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout } from "#/types/loadout"
import type { StatTable } from "#/types/stat-table"
import type { WeaponData } from "#/types/weapon"
import { emptyStatTable } from "#/types/stat-table"
import { getCharacterById, getEchoById, getWeaponById } from "./catalog"
import {
  resolveCharacterBuffs,
  resolveCharacterStats,
} from "./resolve-character"
import { resolveWeaponBuffs, resolveWeaponStats } from "./resolve-weapon"
import {
  resolveEchoBuffs,
  resolveEchoSetBuffs,
  resolveEchoStats,
} from "./resolve-echo"

export interface ResolvedSlot {
  charId: number
  baseStats: StatTable
  buffDefs: BuffDef[]
}

/** Base stats for a configured slot, composed from its character, echoes, and weapon. */
export function resolveBaseStats(
  character: EnrichedCharacter,
  loadout: SlotLoadout | null,
  weapon: WeaponData | null,
): StatTable {
  const stats = emptyStatTable()
  resolveCharacterStats(stats, character)
  resolveEchoStats(stats, character, loadout)
  if (weapon) resolveWeaponStats(stats, weapon)
  return stats
}

/**
 * Resolve one slot into its base stats and full BuffDef contribution. Pure
 * aside from catalog reads. Null when the character id is unknown.
 */
export function resolveSlot(
  charId: number,
  loadout: SlotLoadout | null,
): ResolvedSlot | null {
  const character = getCharacterById(charId)
  if (!character) return null

  const sequence = loadout?.sequence ?? 0
  const weaponId = loadout?.weaponId ?? null
  const weapon = weaponId !== null ? getWeaponById(weaponId) : null

  const baseStats = resolveBaseStats(character, loadout, weapon)

  const buffDefs: BuffDef[] = [...resolveCharacterBuffs(character, sequence)]
  if (weapon) {
    buffDefs.push(...resolveWeaponBuffs(weapon, loadout?.weaponRank ?? 1))
  }
  const echoId = loadout?.echoId ?? null
  if (echoId !== null) {
    const echo = getEchoById(echoId)
    if (echo) buffDefs.push(...resolveEchoBuffs(echo))
  }
  buffDefs.push(
    ...resolveEchoSetBuffs(
      loadout?.echoSetSlot1Id ?? null,
      loadout?.echoSetSlot2Id ?? null,
    ),
  )
  buffDefs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  return { charId, baseStats, buffDefs }
}
