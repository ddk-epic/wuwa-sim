// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { BuffDef, HitContext, HitFilter } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout } from "#/types/loadout"
import type { WeaponData } from "#/types/weapon"
import { emptyStatTable } from "#/types/stat-table"
import {
  accumulateScaledStatEffects,
  accumulateStatEffects,
  compileBaseStats,
  freezeSnapshots,
  matchesHit,
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

  it("two vul stat effects accumulate additively into the vul bucket", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "vul" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    })
    accumulateStatEffects(stats, { def, stacks: 1 })
    accumulateStatEffects(stats, { def, stacks: 1 })
    expect(stats.vul).toBeCloseTo(0.6)
  })

  it("skips scaledByStat effects (layered by the derived pass instead)", () => {
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
    accumulateStatEffects(stats, { def, stacks: 1 })
    expect(stats.critRate).toBe(0)
  })
})

describe("accumulateScaledStatEffects", () => {
  const scaledBuff = () =>
    baseBuff({
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

  it("reads from getCharStat and applies the formula", () => {
    const stats = emptyStatTable()
    // ER = 1.5 → total = 1 + 1.5 = 2.5 → min(2.5/0.002*0.0001, 0.125) = 0.125
    accumulateScaledStatEffects(
      stats,
      { def: scaledBuff(), stacks: 1 },
      () => 1.5,
    )
    expect(stats.critRate).toBeCloseTo(0.125)
  })

  it("caps at max", () => {
    const stats = emptyStatTable()
    accumulateScaledStatEffects(
      stats,
      { def: scaledBuff(), stacks: 1 },
      () => 10.0,
    )
    expect(stats.critRate).toBeCloseTo(0.125)
  })

  it("ignores non-scaledByStat effects", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "critRate" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    })
    accumulateScaledStatEffects(stats, { def, stacks: 1 }, () => 1.5)
    expect(stats.critRate).toBe(0)
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

  it("freezes scaledByStacks against the live stack count of another buff", () => {
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "bonusMultiplier" },
          value: {
            kind: "scaledByStacks",
            buff: "other",
            characterId: 1,
            base: 0.5,
            per: 0.05,
            max: 10,
            snapshot: true,
          },
        },
      ],
    })
    // 0.5 + 0.05 × min(3, 10) = 0.65, read from the stack-count callback.
    expect(freezeSnapshots(def, 1, () => 3)).toEqual({ 0: 0.65 })
  })
})

describe("scaledByStacks ValueExpr", () => {
  const buff = (snapshot: boolean): BuffDef =>
    baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "bonusMultiplier" },
          value: {
            kind: "scaledByStacks",
            buff: "buds",
            characterId: 1,
            base: 0.5,
            per: 0.05,
            max: 10,
            snapshot,
          },
        },
      ],
    })

  it("resolves base + per × stacks live from the stack-count callback", () => {
    const stats = emptyStatTable()
    accumulateStatEffects(stats, { def: buff(false), stacks: 1 }, () => 4)
    expect(stats.bonusMultiplier).toBeCloseTo(0.7)
  })

  it("clamps the stack count to max", () => {
    const stats = emptyStatTable()
    accumulateStatEffects(stats, { def: buff(false), stacks: 1 }, () => 25)
    expect(stats.bonusMultiplier).toBeCloseTo(1.0)
  })

  it("a frozen snapshot ignores later stack changes", () => {
    const def = buff(true)
    const snapshots = freezeSnapshots(def, 1, () => 3)
    const stats = emptyStatTable()
    // Live callback now reports 0 buds; the frozen 0.65 must win.
    accumulateStatEffects(stats, { def, stacks: 1, snapshots }, () => 0)
    expect(stats.bonusMultiplier).toBeCloseTo(0.65)
  })
})

describe("fromStatusStacks ValueExpr", () => {
  const vulBuff = baseBuff({
    effects: [
      {
        kind: "stat",
        path: { stat: "vul" },
        value: {
          kind: "fromStatusStacks",
          status: "Aero Erosion",
          base: 0.3,
          per: 0.1,
          max: 6,
          threshold: 1,
        },
      },
    ],
  })

  const resolve = (statusStacks: number): number => {
    const stats = emptyStatTable()
    accumulateStatEffects(
      stats,
      { def: vulBuff, stacks: 1 },
      undefined,
      () => statusStacks,
    )
    return stats.vul
  }

  it("stays flat at base up to the threshold, then adds per-stack", () => {
    expect(resolve(1)).toBeCloseTo(0.3)
    expect(resolve(2)).toBeCloseTo(0.4)
    expect(resolve(3)).toBeCloseTo(0.5)
  })

  it("clamps the status stack count to max", () => {
    expect(resolve(10)).toBeCloseTo(0.3 + 0.1 * (6 - 1))
  })

  it("reads 0 stacks when no callback is supplied", () => {
    const stats = emptyStatTable()
    accumulateStatEffects(stats, { def: vulBuff, stacks: 1 })
    expect(stats.vul).toBeCloseTo(0.3)
  })

  it("is never frozen — freezeSnapshots ignores it", () => {
    expect(freezeSnapshots(vulBuff, 1, () => 3)).toBeUndefined()
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
    const statsWithWeapon = compileBaseStats(char, null, weapon)
    const statsNoWeapon = compileBaseStats(char, null, null)
    expect(statsWithWeapon.atkBase - statsNoWeapon.atkBase).toBeCloseTo(500)
    expect(statsWithWeapon.critRate - statsNoWeapon.critRate).toBeCloseTo(0.1)
  })

  it("skillBonusPriority override routes skill dmg bonus to that skill type", () => {
    const char = baseChar({ skillBonusPriority: "Resonance Skill" })
    const stats = compileBaseStats(char, null, null)
    expect(stats.skillTypeBonus["Resonance Skill"]).toBeGreaterThan(0)
    expect(stats.skillTypeBonus["Resonance Liberation"]).toBe(0)
  })
})

describe("matchesHit", () => {
  const ctx: HitContext = {
    sourceBuffId: "buff.a",
    stageId: "stage.b",
    skillType: "Basic Attack",
    skillCategory: "Basic Attack",
    element: "Glacio",
  }

  it("empty filter matches any hit", () => {
    expect(matchesHit({}, ctx)).toBe(true)
  })

  it("matches when every specified axis matches — scalar form", () => {
    const f: HitFilter = { sourceBuff: "buff.a", element: "Glacio" }
    expect(matchesHit(f, ctx)).toBe(true)
  })

  it("matches when axis value is in array form", () => {
    const f: HitFilter = { sourceBuff: ["buff.x", "buff.a"] }
    expect(matchesHit(f, ctx)).toBe(true)
  })

  it("fails when scalar axis does not match", () => {
    const f: HitFilter = { sourceBuff: "buff.other" }
    expect(matchesHit(f, ctx)).toBe(false)
  })

  it("fails when array axis does not contain value", () => {
    const f: HitFilter = { sourceBuff: ["buff.x", "buff.y"] }
    expect(matchesHit(f, ctx)).toBe(false)
  })

  it("fails when constrained axis is absent from hit", () => {
    const noSource: HitContext = { skillType: "Basic Attack" }
    const f: HitFilter = { sourceBuff: "buff.a" }
    expect(matchesHit(f, noSource)).toBe(false)
  })

  it("matches all axes independently", () => {
    expect(matchesHit({ stageId: "stage.b" }, ctx)).toBe(true)
    expect(matchesHit({ skillType: "Basic Attack" }, ctx)).toBe(true)
    expect(matchesHit({ skillCategory: "Basic Attack" }, ctx)).toBe(true)
    expect(matchesHit({ element: "Glacio" }, ctx)).toBe(true)
  })

  it("fails on any mismatched axis even if others match", () => {
    const f: HitFilter = { sourceBuff: "buff.a", element: "Fusion" }
    expect(matchesHit(f, ctx)).toBe(false)
  })

  it("label axis matches when the hit carries one of the wanted labels", () => {
    const labelled: HitContext = { labels: ["Aero Erosion"] }
    expect(matchesHit({ label: "Aero Erosion" }, labelled)).toBe(true)
    expect(matchesHit({ label: ["Aero Erosion"] }, labelled)).toBe(true)
    expect(
      matchesHit({ label: "Aero Erosion" }, { skillType: "Basic Attack" }),
    ).toBe(false)
    expect(matchesHit({ label: "Aero Erosion" }, { labels: [] })).toBe(false)
  })

  it("stage axes: stageId is exact, hitIndex and skill are independent", () => {
    const hit: HitContext = {
      stageId: "char.x.basic-attack.skill.stage::basic-attack",
      skill: "skill",
      hitIndex: 3,
    }
    // A stageId-only filter matches any hit index of that stage.
    expect(
      matchesHit(
        { stageId: "char.x.basic-attack.skill.stage::basic-attack" },
        hit,
      ),
    ).toBe(true)
    // A hitIndex constraint requires the exact hit position.
    expect(matchesHit({ hitIndex: 3 }, hit)).toBe(true)
    expect(matchesHit({ hitIndex: 1 }, hit)).toBe(false)
    // The skill axis matches every stage of the skill.
    expect(matchesHit({ skill: "skill" }, hit)).toBe(true)
    expect(matchesHit({ skill: "other" }, hit)).toBe(false)
    // Array form: any listed id matching is enough.
    expect(
      matchesHit(
        {
          stageId: [
            "char.x.basic-attack.other.stage::basic-attack",
            "char.x.basic-attack.skill.stage::basic-attack",
          ],
        },
        hit,
      ),
    ).toBe(true)
  })
})
