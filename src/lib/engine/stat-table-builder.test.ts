import { describe, expect, it } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout } from "#/types/loadout"
import type { WeaponData } from "#/types/weapon"
import { emptyStatTable } from "#/types/stat-table"
import {
  accumulateStatEffects,
  compileBaseStats,
  freezeSnapshots,
} from "./stat-table-builder"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_MAIN_1COST_SCALING,
  ECHO_MAIN_3COST_VARIABLE,
  ECHO_MAIN_4COST_VARIABLE,
  ECHO_MAIN_FIXED,
  ECHO_SUBSTAT,
} from "../loadout/echo-stat-constants"

const baseBuff = (overrides: Partial<BuffDef>): BuffDef => ({
  id: "b",
  name: "B",
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  effects: [],
  ...overrides,
})

describe("accumulateStatEffects", () => {
  it("writes a const stat effect into the table", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    })
    accumulateStatEffects(stats, { def, stacks: 1 })
    expect(stats.atkPct).toBeCloseTo(0.2)
  })

  it("multiplies perStack values by stacks", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.05 },
        },
      ],
    })
    accumulateStatEffects(stats, { def, stacks: 3 })
    expect(stats.atkPct).toBeCloseTo(0.15)
  })

  it("uses snapshotted value when provided", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.05, snapshot: true },
        },
      ],
    })
    const snapshots = freezeSnapshots(def, 4)
    accumulateStatEffects(stats, { def, stacks: 1, snapshots })
    expect(stats.atkPct).toBeCloseTo(0.2)
  })

  it("ignores non-stat effects", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "resource",
          resource: "energy",
          op: "add",
          value: { kind: "const", v: 10 },
        },
      ],
    })
    accumulateStatEffects(stats, { def, stacks: 1 })
    expect(stats.atkPct).toBe(0)
  })

  it("writes into keyed stat paths", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    })
    accumulateStatEffects(stats, { def, stacks: 1 })
    expect(stats.elementBonus.Fusion).toBeCloseTo(0.3)
  })

  it("scaledByStat reads from getCharStat and applies formula", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "critRate" },
          value: {
            kind: "scaledByStat",
            stat: "energyRechargePct",
            characterId: 99,
            base: 1,
            per: 0.002,
            scale: 0.0001,
            max: 0.125,
          },
        },
      ],
    })
    // energyRechargePct = 1.5 → total ER = 1 + 1.5 = 2.5 → min(2.5/0.002*0.0001, 0.125) = 0.125
    const getCharStat = (_cid: number, _stat: string) => 1.5
    accumulateStatEffects(stats, { def, stacks: 1 }, getCharStat)
    expect(stats.critRate).toBeCloseTo(0.125)
  })

  it("scaledByStat caps at max", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "critRate" },
          value: {
            kind: "scaledByStat",
            stat: "energyRechargePct",
            characterId: 99,
            base: 1,
            per: 0.002,
            scale: 0.0001,
            max: 0.125,
          },
        },
      ],
    })
    // ER = 10.0 (very high) → without cap would exceed 0.125
    const getCharStat = (_cid: number, _stat: string) => 10.0
    accumulateStatEffects(stats, { def, stacks: 1 }, getCharStat)
    expect(stats.critRate).toBeCloseTo(0.125)
  })

  it("scaledByStat returns 0 when getCharStat is not provided", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "critRate" },
          value: {
            kind: "scaledByStat",
            stat: "energyRechargePct",
            characterId: 99,
            base: 1,
            per: 0.002,
            scale: 0.0001,
            max: 0.125,
          },
        },
      ],
    })
    // raw = 0, base = 1 → min((1+0)/0.002*0.0001, 0.125) = min(0.05, 0.125) = 0.05
    accumulateStatEffects(stats, { def, stacks: 1 })
    expect(stats.critRate).toBeCloseTo(0.05)
  })
})

describe("freezeSnapshots", () => {
  it("returns undefined when no effects request snapshotting", () => {
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    })
    expect(freezeSnapshots(def, 1)).toBeUndefined()
  })

  it("freezes perStack values multiplied by stacks at snapshot time", () => {
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.05, snapshot: true },
        },
      ],
    })
    expect(freezeSnapshots(def, 4)).toEqual({ 0: 0.2 })
  })
})

const baseChar = (
  overrides: Partial<EnrichedCharacter> = {},
): EnrichedCharacter => ({
  id: 1,
  name: "Test",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
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

describe("compileBaseStats", () => {
  it("populates character base atk/hp/def from character max stats", () => {
    const char = baseChar()
    const stats = compileBaseStats(char, null, null)
    expect(stats.atkBase).toBe(800)
    expect(stats.hpBase).toBe(1000)
    expect(stats.defBase).toBe(500)
  })

  it("null loadout uses defaults: 4-3-3-1-1, cd cost4, elemDmg×2 cost3", () => {
    const char = baseChar()
    const stats = compileBaseStats(char, null, null)
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
    const stats = compileBaseStats(
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
    const stats = compileBaseStats(
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
        ECHO_MAIN_4COST_VARIABLE.scalingHp +
        2 * ECHO_MAIN_3COST_VARIABLE.scalingHp,
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
    const statsWithWeapon = compileBaseStats(char, null, weapon)
    const statsNoWeapon = compileBaseStats(char, null, null)
    expect(statsWithWeapon.atkBase - statsNoWeapon.atkBase).toBeCloseTo(500)
    expect(statsWithWeapon.critRate - statsNoWeapon.critRate).toBeCloseTo(0.1)
  })

  it("recommendedSkillDmgPriority override routes skill dmg bonus to that skill type", () => {
    const char = baseChar({ recommendedSkillDmgPriority: "Resonance Skill" })
    const stats = compileBaseStats(char, null, null)
    expect(stats.skillTypeBonus["Resonance Skill"]).toBeGreaterThan(0)
    expect(stats.skillTypeBonus["Resonance Liberation"]).toBe(0)
  })
})
