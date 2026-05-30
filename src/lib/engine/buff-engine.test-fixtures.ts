import type { DamageEntry, EnrichedCharacter } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_BUILD_LAYOUT,
  ECHO_MAIN_1COST_SCALING,
  ECHO_SUBSTAT,
} from "../loadout/echo-stat-constants"

export const CHARACTER_BASE_CRIT_RATE = 0.05
export const BASE_ATK_PCT =
  DEFAULT_SUBSTAT_ROLLS.scalingMain * ECHO_SUBSTAT.atkPct +
  ECHO_BUILD_LAYOUT["4-3-3-1-1"].cost1 * ECHO_MAIN_1COST_SCALING.atk
export const BASE_CR =
  CHARACTER_BASE_CRIT_RATE +
  DEFAULT_SUBSTAT_ROLLS.critRate * ECHO_SUBSTAT.critRate
export const BASE_ER =
  DEFAULT_SUBSTAT_ROLLS.energyRechargePct * ECHO_SUBSTAT.energyRechargePct

export const baseChar = (
  overrides: Partial<EnrichedCharacter> = {},
): EnrichedCharacter => ({
  id: 1,
  name: "Test",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [],
  ...overrides,
})

export const slotsOf = (id: number): Slots => [id, null, null]

export const emptyLoadout: SlotLoadout = {
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
  echoBuild: "4-3-3-1-1",
  cost4Mains: ["cd"],
  cost3Mains: ["elemDmg", "elemDmg"],
}

export const dmg = (
  overrides: Partial<{
    value: number
    dmgType: string
    energy: number
    concerto: number
  }> = {},
): DamageEntry => ({
  type: "Basic Attack",
  dmgType: "Fusion",
  scalingStat: "atk",
  actionFrame: 0,
  value: 1.0,
  energy: 0,
  concerto: 0,
  toughness: 0,
  weakness: 0,
  ...overrides,
})
