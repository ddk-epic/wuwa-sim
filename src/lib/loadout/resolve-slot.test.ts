// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout } from "#/types/loadout"
import type { WeaponData } from "#/types/weapon"
import { resolveBaseStats } from "./resolve-slot"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_MAIN_1COST_SCALING,
  ECHO_MAIN_3COST_VARIABLE,
  ECHO_MAIN_4COST_VARIABLE,
  ECHO_MAIN_FIXED,
  ECHO_SUBSTAT,
} from "./echo-stat-constants"

const baseChar = (
  overrides: Partial<EnrichedCharacter> = {},
): EnrichedCharacter => ({
  id: 1,
  name: "Test",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  maxEnergy: 100,
  forteCap: 100,
  stats: {
    base: { hp: 0, atk: 0, def: 0 },
    max: { hp: 1000, atk: 800, def: 500 },
  },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [],
  ...overrides,
})

const baseWeapon = (overrides: Partial<WeaponData> = {}): WeaponData => ({
  id: 10,
  name: "TestWeapon",
  weaponType: "Sword",
  stats: {
    main: { name: "ATK", base: 0, max: 500 },
    sub: { name: "Crit. Rate", base: 0, max: 0.1 },
  },
  passive: { name: "Test Passive" },
  buffs: [],
  ...overrides,
})

const baseLoadout = (overrides: Partial<SlotLoadout> = {}): SlotLoadout => ({
  sequence: 0,
  weaponId: null,
  weaponRank: 1,
  echoBuild: "4-3-3-1-1",
  cost4Mains: ["cd"],
  cost3Mains: ["elemDmg", "elemDmg"],
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  ...overrides,
})

describe("resolveBaseStats", () => {
  it("populates character base atk/hp/def from character max stats", () => {
    const char = baseChar()
    const stats = resolveBaseStats(char, null, null)
    expect(stats.atkBase).toBe(800)
    expect(stats.hpBase).toBe(1000)
    expect(stats.defBase).toBe(500)
  })

  it("null loadout uses defaults: 4-3-3-1-1, cd cost4, elemDmg×2 cost3", () => {
    const char = baseChar()
    const stats = resolveBaseStats(char, null, null)
    const { cost4, cost3, cost1 } = { cost4: 1, cost3: 2, cost1: 2 }
    expect(stats.atkFlat).toBeCloseTo(
      cost4 * ECHO_MAIN_FIXED.cost4FlatAtk +
        cost3 * ECHO_MAIN_FIXED.cost3FlatAtk,
    )
    expect(stats.hpFlat).toBeCloseTo(cost1 * ECHO_MAIN_FIXED.cost1FlatHp)
    expect(stats.critDmg).toBeGreaterThan(0)
    expect(stats.elementBonus["Fusion"]).toBeGreaterThan(0)
  })

  it("4-4-1-1-1 echoBuild applies correct fixed atk and hp", () => {
    const char = baseChar()
    const stats = resolveBaseStats(
      char,
      baseLoadout({ echoBuild: "4-4-1-1-1" }),
      null,
    )
    expect(stats.atkFlat).toBeCloseTo(
      2 * ECHO_MAIN_FIXED.cost4FlatAtk + 0 * ECHO_MAIN_FIXED.cost3FlatAtk,
    )
    expect(stats.hpFlat).toBeCloseTo(3 * ECHO_MAIN_FIXED.cost1FlatHp)
    expect(stats.atkPct).toBeGreaterThan(0)
  })

  it("hp scaler routes cost-1 and cost-4 scaling to hpPct", () => {
    const char = baseChar({ primaryScalingStat: "hp" })
    const stats = resolveBaseStats(
      char,
      baseLoadout({
        cost4Mains: ["scaling"],
        cost3Mains: ["scaling", "scaling"],
      }),
      null,
    )
    expect(stats.atkPct).toBeCloseTo(0)
    expect(stats.hpPct).toBeCloseTo(
      DEFAULT_SUBSTAT_ROLLS.scalingMain * ECHO_SUBSTAT.hpPct +
        2 * ECHO_MAIN_1COST_SCALING.hp +
        ECHO_MAIN_4COST_VARIABLE.scaling.hp +
        2 * ECHO_MAIN_3COST_VARIABLE.scaling.hp,
    )
  })

  it("weapon ATK main adds to atkBase and Crit. Rate sub adds to critRate", () => {
    const char = baseChar()
    const weapon = baseWeapon({
      stats: {
        main: { name: "ATK", base: 0, max: 500 },
        sub: { name: "Crit. Rate", base: 0, max: 0.1 },
      },
    })
    const statsWithWeapon = resolveBaseStats(char, null, weapon)
    const statsNoWeapon = resolveBaseStats(char, null, null)
    expect(statsWithWeapon.atkBase - statsNoWeapon.atkBase).toBeCloseTo(500)
    expect(statsWithWeapon.critRate - statsNoWeapon.critRate).toBeCloseTo(0.1)
  })

  it("skillBonusPriority override routes skill dmg bonus to that skill type", () => {
    const char = baseChar({ skillBonusPriority: "Resonance Skill" })
    const stats = resolveBaseStats(char, null, null)
    expect(stats.skillTypeBonus["Resonance Skill"]).toBeGreaterThan(0)
    expect(stats.skillTypeBonus["Resonance Liberation"]).toBe(0)
  })
})
