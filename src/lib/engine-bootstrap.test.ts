import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho, EchoSet } from "#/types/echo"
import type { WeaponData } from "#/types/weapon"
import {
  accumulateCost3Mains,
  accumulateCost4Mains,
  accumulateEchoMainBlock,
  accumulateEchoSubstatBlock,
  buildCharacterBuffDefs,
  buildEchoBuffDefs,
  buildEchoSetBuffDefs,
  buildWeaponBuffDefs,
} from "./engine-bootstrap"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_BUILD_LAYOUT,
  ECHO_MAIN_1COST_SCALING,
  ECHO_MAIN_3COST_VARIABLE,
  ECHO_MAIN_4COST_VARIABLE,
  ECHO_MAIN_FIXED,
  ECHO_SUBSTAT,
} from "./echo-stat-constants"
import { emptyStatTable } from "#/types/stat-table"

let testEchoSets: EchoSet[] = []

vi.mock("./catalog", () => ({
  getCharacterById: () => null,
  getEchoById: () => null,
  getEchoSetById: (id: number) => testEchoSets.find((s) => s.id === id) ?? null,
  getWeaponById: () => null,
}))

vi.mock("./resolve-echo-sets", () => ({
  resolveEchoSets: (slot1Id: number | null, slot2Id: number | null) => {
    if (slot1Id === null && slot2Id === null) return []
    if (slot1Id !== null && slot2Id !== null && slot1Id === slot2Id) {
      return [{ setId: slot1Id, effectivePieces: 2 }]
    }
    const results = []
    if (slot1Id !== null) results.push({ setId: slot1Id, effectivePieces: 1 })
    if (slot2Id !== null) results.push({ setId: slot2Id, effectivePieces: 1 })
    return results
  },
}))

afterEach(() => {
  testEchoSets = []
})

const simStartPermanentBuff = (id: string): BuffDef => ({
  id,
  name: id,
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  effects: [],
})

const baseChar = (
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

const baseEcho = (overrides: Partial<EnrichedEcho> = {}): EnrichedEcho => ({
  id: 20,
  name: "TestEcho",
  cost: 3,
  element: "Glacio",
  set: "TestSet",
  buffs: [],
  skill: { cooldown: 20, description: "", stages: [] },
  ...overrides,
})

const baseEchoSet = (
  id: number,
  overrides: Partial<EchoSet> = {},
): EchoSet => ({
  id,
  name: `Set${id}`,
  type: "two-five",
  effects: [],
  buffs: [],
  ...overrides,
})

describe("buildCharacterBuffDefs", () => {
  it("includes all char buffs when sequence gate is 0", () => {
    const buff = simStartPermanentBuff("char.buff")
    const char = baseChar({ buffs: [buff] })
    expect(buildCharacterBuffDefs(char, 0)).toContainEqual(buff)
  })

  it("excludes buffs with requiresSequence above current sequence", () => {
    const buff: BuffDef = {
      ...simStartPermanentBuff("s2.buff"),
      requiresSequence: 2,
    }
    const char = baseChar({ buffs: [buff] })
    expect(buildCharacterBuffDefs(char, 1)).toHaveLength(0)
    expect(buildCharacterBuffDefs(char, 2)).toHaveLength(1)
  })

  it("compiles skill-tree Crit. Rate node into a buff def", () => {
    const char = baseChar({ skillTreeBonuses: ["Crit. Rate"] })
    const defs = buildCharacterBuffDefs(char, 0)
    expect(defs).toHaveLength(1)
    expect(defs[0].effects[0]).toMatchObject({
      kind: "stat",
      path: { stat: "critRate" },
    })
  })

  it("compiles skill-tree element bonus node into a buff def", () => {
    const char = baseChar({ skillTreeBonuses: ["Fusion DMG Bonus"] })
    const defs = buildCharacterBuffDefs(char, 0)
    expect(defs).toHaveLength(1)
    expect(defs[0].effects[0]).toMatchObject({
      path: { stat: "elementBonus", key: "Fusion" },
    })
  })

  it("returns empty array when char has no buffs or skill tree bonuses", () => {
    expect(buildCharacterBuffDefs(baseChar(), 0)).toHaveLength(0)
  })
})

describe("buildWeaponBuffDefs", () => {
  it("returns resolved weapon buffs at the given rank", () => {
    const weapon = baseWeapon({
      buffs: [
        {
          ...simStartPermanentBuff("w.buff"),
          effects: [
            {
              kind: "stat",
              path: { stat: "critDmg" },
              value: { kind: "const", v: [0.1, 0.2, 0.3, 0.4, 0.5] },
            },
          ],
        },
      ],
    })
    const defs = buildWeaponBuffDefs(weapon, 1)
    expect(defs).toHaveLength(1)
    expect(defs[0].effects[0]).toMatchObject({
      kind: "stat",
      path: { stat: "critDmg" },
      value: { kind: "const", v: 0.1 },
    })
  })

  it("resolves array v at rank 5", () => {
    const weapon = baseWeapon({
      buffs: [
        {
          ...simStartPermanentBuff("w.buff"),
          effects: [
            {
              kind: "stat",
              path: { stat: "critDmg" },
              value: { kind: "const", v: [0.1, 0.2, 0.3, 0.4, 0.5] },
            },
          ],
        },
      ],
    })
    const defs = buildWeaponBuffDefs(weapon, 5)
    expect(defs[0].effects[0]).toMatchObject({
      value: { kind: "const", v: 0.5 },
    })
  })

  it("returns empty array when weapon has no buffs", () => {
    expect(buildWeaponBuffDefs(baseWeapon(), 1)).toHaveLength(0)
  })
})

describe("buildEchoBuffDefs", () => {
  it("returns echo.buffs directly", () => {
    const buff = simStartPermanentBuff("echo.buff")
    const echo = baseEcho({ buffs: [buff] })
    expect(buildEchoBuffDefs(echo)).toEqual([buff])
  })

  it("returns empty array when echo has no buffs", () => {
    expect(buildEchoBuffDefs(baseEcho())).toHaveLength(0)
  })
})

describe("buildEchoSetBuffDefs", () => {
  it("returns empty array when both slots are null", () => {
    expect(buildEchoSetBuffDefs(null, null)).toHaveLength(0)
  })

  it("includes 2-piece buff when two slots share the same set", () => {
    const twoPieceBuff: BuffDef = {
      ...simStartPermanentBuff("set.2pc"),
      requiresPieces: 2,
    }
    testEchoSets = [baseEchoSet(1, { buffs: [twoPieceBuff] })]
    const result = buildEchoSetBuffDefs(1, 1)
    expect(result).toContainEqual(twoPieceBuff)
  })

  it("excludes 5-piece buff when only 2 pieces are active", () => {
    const fivePieceBuff: BuffDef = {
      ...simStartPermanentBuff("set.5pc"),
      requiresPieces: 5,
    }
    testEchoSets = [baseEchoSet(1, { buffs: [fivePieceBuff] })]
    const result = buildEchoSetBuffDefs(1, 1)
    expect(result).toHaveLength(0)
  })
})

describe("accumulateEchoSubstatBlock", () => {
  const crExpected = DEFAULT_SUBSTAT_ROLLS.critRate * ECHO_SUBSTAT.critRate
  const cdExpected = DEFAULT_SUBSTAT_ROLLS.critDmg * ECHO_SUBSTAT.critDmg
  const atkPctExpected = DEFAULT_SUBSTAT_ROLLS.atkPct * ECHO_SUBSTAT.atkPct
  const erExpected =
    DEFAULT_SUBSTAT_ROLLS.energyRechargePct * ECHO_SUBSTAT.energyRechargePct
  const skillExpected =
    DEFAULT_SUBSTAT_ROLLS.skillDmgBonus * ECHO_SUBSTAT.skillDmgBonus

  it("accumulates critRate from 5 rolls", () => {
    const stats = emptyStatTable()
    accumulateEchoSubstatBlock(stats, baseChar())
    expect(stats.critRate).toBeCloseTo(crExpected)
  })

  it("accumulates critDmg from 5 rolls", () => {
    const stats = emptyStatTable()
    accumulateEchoSubstatBlock(stats, baseChar())
    expect(stats.critDmg).toBeCloseTo(cdExpected)
  })

  it("accumulates atkPct from 2 rolls", () => {
    const stats = emptyStatTable()
    accumulateEchoSubstatBlock(stats, baseChar())
    expect(stats.atkPct).toBeCloseTo(atkPctExpected)
  })

  it("accumulates energyRechargePct from 2 rolls", () => {
    const stats = emptyStatTable()
    accumulateEchoSubstatBlock(stats, baseChar())
    expect(stats.energyRechargePct).toBeCloseTo(erExpected)
  })

  it("routes skill dmg bonus to recommendedSkillDmgPriority", () => {
    const stats = emptyStatTable()
    accumulateEchoSubstatBlock(
      stats,
      baseChar({ recommendedSkillDmgPriority: "Resonance Skill" }),
    )
    expect(stats.skillTypeBonus["Resonance Skill"]).toBeCloseTo(skillExpected)
  })

  it("falls back to Resonance Liberation when priority is not set", () => {
    const stats = emptyStatTable()
    accumulateEchoSubstatBlock(stats, baseChar())
    expect(stats.skillTypeBonus["Resonance Liberation"]).toBeCloseTo(
      skillExpected,
    )
  })
})

describe("accumulateEchoMainBlock", () => {
  it("4-3-3-1-1 atk scaler: correct flat ATK, flat HP, atkPct", () => {
    const stats = emptyStatTable()
    accumulateEchoMainBlock(stats, "4-3-3-1-1", "atk")
    const { cost4, cost3, cost1 } = ECHO_BUILD_LAYOUT["4-3-3-1-1"]
    expect(stats.atkFlat).toBeCloseTo(
      cost4 * ECHO_MAIN_FIXED.cost4FlatAtk +
        cost3 * ECHO_MAIN_FIXED.cost3FlatAtk,
    )
    expect(stats.hpFlat).toBeCloseTo(cost1 * ECHO_MAIN_FIXED.cost1FlatHp)
    expect(stats.atkPct).toBeCloseTo(cost1 * ECHO_MAIN_1COST_SCALING.atk)
    expect(stats.hpPct).toBe(0)
    expect(stats.defPct).toBe(0)
  })

  it("4-4-1-1-1 atk scaler: correct flat ATK, flat HP, atkPct", () => {
    const stats = emptyStatTable()
    accumulateEchoMainBlock(stats, "4-4-1-1-1", "atk")
    const { cost4, cost3, cost1 } = ECHO_BUILD_LAYOUT["4-4-1-1-1"]
    expect(stats.atkFlat).toBeCloseTo(
      cost4 * ECHO_MAIN_FIXED.cost4FlatAtk +
        cost3 * ECHO_MAIN_FIXED.cost3FlatAtk,
    )
    expect(stats.hpFlat).toBeCloseTo(cost1 * ECHO_MAIN_FIXED.cost1FlatHp)
    expect(stats.atkPct).toBeCloseTo(cost1 * ECHO_MAIN_1COST_SCALING.atk)
  })

  it("routes cost-1 mains to hpPct for hp scaler", () => {
    const stats = emptyStatTable()
    accumulateEchoMainBlock(stats, "4-3-3-1-1", "hp")
    const { cost1 } = ECHO_BUILD_LAYOUT["4-3-3-1-1"]
    expect(stats.hpPct).toBeCloseTo(cost1 * ECHO_MAIN_1COST_SCALING.hp)
    expect(stats.atkPct).toBe(0)
    expect(stats.defPct).toBe(0)
  })

  it("routes cost-1 mains to defPct for def scaler", () => {
    const stats = emptyStatTable()
    accumulateEchoMainBlock(stats, "4-3-3-1-1", "def")
    const { cost1 } = ECHO_BUILD_LAYOUT["4-3-3-1-1"]
    expect(stats.defPct).toBeCloseTo(cost1 * ECHO_MAIN_1COST_SCALING.def)
    expect(stats.atkPct).toBe(0)
    expect(stats.hpPct).toBe(0)
  })
})

describe("accumulateCost4Mains", () => {
  it("cr adds critRate", () => {
    const stats = emptyStatTable()
    accumulateCost4Mains(stats, ["cr"], "atk")
    expect(stats.critRate).toBeCloseTo(ECHO_MAIN_4COST_VARIABLE.cr)
    expect(stats.critDmg).toBe(0)
  })

  it("cd adds critDmg", () => {
    const stats = emptyStatTable()
    accumulateCost4Mains(stats, ["cd"], "atk")
    expect(stats.critDmg).toBeCloseTo(ECHO_MAIN_4COST_VARIABLE.cd)
    expect(stats.critRate).toBe(0)
  })

  it("scaling routes to atkPct for atk scaler", () => {
    const stats = emptyStatTable()
    accumulateCost4Mains(stats, ["scaling"], "atk")
    expect(stats.atkPct).toBeCloseTo(ECHO_MAIN_4COST_VARIABLE.scalingAtk)
    expect(stats.hpPct).toBe(0)
    expect(stats.defPct).toBe(0)
  })

  it("scaling routes to hpPct for hp scaler", () => {
    const stats = emptyStatTable()
    accumulateCost4Mains(stats, ["scaling"], "hp")
    expect(stats.hpPct).toBeCloseTo(ECHO_MAIN_4COST_VARIABLE.scalingHp)
    expect(stats.atkPct).toBe(0)
  })

  it("scaling routes to defPct for def scaler", () => {
    const stats = emptyStatTable()
    accumulateCost4Mains(stats, ["scaling"], "def")
    expect(stats.defPct).toBeCloseTo(ECHO_MAIN_4COST_VARIABLE.scalingDef)
    expect(stats.atkPct).toBe(0)
  })

  it("[cr, cd] accumulates both", () => {
    const stats = emptyStatTable()
    accumulateCost4Mains(stats, ["cr", "cd"], "atk")
    expect(stats.critRate).toBeCloseTo(ECHO_MAIN_4COST_VARIABLE.cr)
    expect(stats.critDmg).toBeCloseTo(ECHO_MAIN_4COST_VARIABLE.cd)
  })

  it("empty array does not modify stats", () => {
    const stats = emptyStatTable()
    accumulateCost4Mains(stats, [], "atk")
    expect(stats.critRate).toBe(0)
    expect(stats.critDmg).toBe(0)
    expect(stats.atkPct).toBe(0)
  })
})

describe("accumulateCost3Mains", () => {
  it("er adds energyRechargePct", () => {
    const stats = emptyStatTable()
    accumulateCost3Mains(stats, ["er"], "atk", "Fusion")
    expect(stats.energyRechargePct).toBeCloseTo(ECHO_MAIN_3COST_VARIABLE.er)
    expect(stats.atkPct).toBe(0)
  })

  it("elemDmg routes to elementBonus[element]", () => {
    const stats = emptyStatTable()
    accumulateCost3Mains(stats, ["elemDmg"], "atk", "Aero")
    expect(stats.elementBonus["Aero"]).toBeCloseTo(
      ECHO_MAIN_3COST_VARIABLE.elemDmg,
    )
    expect(stats.elementBonus["Fusion"]).toBeUndefined()
  })

  it("scaling routes to atkPct for atk scaler", () => {
    const stats = emptyStatTable()
    accumulateCost3Mains(stats, ["scaling"], "atk", "Fusion")
    expect(stats.atkPct).toBeCloseTo(ECHO_MAIN_3COST_VARIABLE.scalingAtk)
  })

  it("scaling routes to hpPct for hp scaler", () => {
    const stats = emptyStatTable()
    accumulateCost3Mains(stats, ["scaling"], "hp", "Fusion")
    expect(stats.hpPct).toBeCloseTo(ECHO_MAIN_3COST_VARIABLE.scalingHp)
  })

  it("scaling routes to defPct for def scaler", () => {
    const stats = emptyStatTable()
    accumulateCost3Mains(stats, ["scaling"], "def", "Fusion")
    expect(stats.defPct).toBeCloseTo(ECHO_MAIN_3COST_VARIABLE.scalingDef)
  })

  it("[elemDmg, elemDmg] accumulates twice on the same element", () => {
    const stats = emptyStatTable()
    accumulateCost3Mains(stats, ["elemDmg", "elemDmg"], "atk", "Glacio")
    expect(stats.elementBonus["Glacio"]).toBeCloseTo(
      2 * ECHO_MAIN_3COST_VARIABLE.elemDmg,
    )
  })

  it("empty array does not modify stats", () => {
    const stats = emptyStatTable()
    accumulateCost3Mains(stats, [], "atk", "Fusion")
    expect(stats.energyRechargePct).toBe(0)
    expect(stats.atkPct).toBe(0)
  })
})
