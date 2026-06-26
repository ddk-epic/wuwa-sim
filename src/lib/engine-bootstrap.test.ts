// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho, EchoSet } from "#/types/echo"
import type { WeaponData } from "#/types/weapon"
import {
  bootstrapSlot,
  buildCharacterBuffDefs,
  buildEchoBuffDefs,
  buildEchoSetBuffDefs,
  buildWeaponBuffDefs,
  validateBuffDef,
} from "./engine-bootstrap"

let testEchoSets: EchoSet[] = []
let testChar: EnrichedCharacter | null = null

vi.mock("./loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testChar && testChar.id === id ? testChar : null,
  getEchoById: () => null,
  getEchoSetById: (id: number) => testEchoSets.find((s) => s.id === id) ?? null,
  getWeaponById: () => null,
}))

vi.mock("./loadout/resolve-echo-sets", () => ({
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
  testChar = null
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
  maxEnergy: 100,
  forteCap: 100,
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
  sets: ["TestSet"],
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

  it("excludes buffs with maxSequence below current sequence", () => {
    const buff: BuffDef = {
      ...simStartPermanentBuff("s0.buff"),
      maxSequence: 0,
    }
    const char = baseChar({ buffs: [buff] })
    expect(buildCharacterBuffDefs(char, 0)).toHaveLength(1)
    expect(buildCharacterBuffDefs(char, 1)).toHaveLength(0)
    expect(buildCharacterBuffDefs(char, 6)).toHaveLength(0)
  })

  it("includes buffs when requiresSequence and maxSequence both satisfied", () => {
    const buff: BuffDef = {
      ...simStartPermanentBuff("s1-only.buff"),
      requiresSequence: 1,
      maxSequence: 2,
    }
    const char = baseChar({ buffs: [buff] })
    expect(buildCharacterBuffDefs(char, 0)).toHaveLength(0)
    expect(buildCharacterBuffDefs(char, 1)).toHaveLength(1)
    expect(buildCharacterBuffDefs(char, 2)).toHaveLength(1)
    expect(buildCharacterBuffDefs(char, 3)).toHaveLength(0)
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

describe("bootstrapSlot — self wielder-id filter (#343)", () => {
  const wielderBuff = (characterId: number | number[]): BuffDef => ({
    ...simStartPermanentBuff("char.wielder-passive"),
    target: { kind: "self", characterId },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 0.1 },
      },
    ],
  })

  it("folds a permanent self-passive when the slot char is listed (scalar)", () => {
    testChar = baseChar({ id: 5, buffs: [wielderBuff(5)] })
    const slot = bootstrapSlot(5, null)
    expect(slot?.foldedBuffs.map((b) => b.id)).toContain("char.wielder-passive")
  })

  it("does not fold or instance for an unlisted slot char (scalar)", () => {
    testChar = baseChar({ id: 5, buffs: [wielderBuff(7)] })
    const slot = bootstrapSlot(5, null)
    expect(slot?.foldedBuffs.map((b) => b.id)).not.toContain(
      "char.wielder-passive",
    )
    expect(slot?.permanentInstances).toHaveLength(0)
    expect(slot?.triggerable).toHaveLength(0)
  })

  it("honors the array form", () => {
    testChar = baseChar({ id: 8, buffs: [wielderBuff([7, 8])] })
    const slot = bootstrapSlot(8, null)
    expect(slot?.foldedBuffs.map((b) => b.id)).toContain("char.wielder-passive")

    testChar = baseChar({ id: 9, buffs: [wielderBuff([7, 8])] })
    const slot2 = bootstrapSlot(9, null)
    expect(slot2?.foldedBuffs.map((b) => b.id)).not.toContain(
      "char.wielder-passive",
    )
  })

  it("omitted characterId folds as today", () => {
    const buff: BuffDef = {
      ...simStartPermanentBuff("char.plain-passive"),
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testChar = baseChar({ id: 5, buffs: [buff] })
    const slot = bootstrapSlot(5, null)
    expect(slot?.foldedBuffs.map((b) => b.id)).toContain("char.plain-passive")
  })
})

describe("validateBuffDef (#220)", () => {
  const baseTrigger: BuffDef["trigger"] = {
    event: "skillCast",
    characterId: 1,
  }

  it("accepts a valid stateful buff (target + duration both present)", () => {
    expect(() =>
      validateBuffDef({
        id: "test.stateful",
        name: "Stateful",
        trigger: baseTrigger,
        target: { kind: "self" },
        duration: { kind: "frames", v: 10 },
        effects: [
          {
            kind: "stat",
            path: { stat: "atkPct" },
            value: { kind: "const", v: 0.1 },
          },
        ],
      }),
    ).not.toThrow()
  })

  it("accepts a valid reaction (target + duration both absent)", () => {
    expect(() =>
      validateBuffDef({
        id: "test.reaction",
        name: "Reaction",
        trigger: baseTrigger,
        effects: [
          {
            kind: "resource",
            resource: "forte",
            op: "add",
            value: { kind: "const", v: 1 },
          },
        ],
      }),
    ).not.toThrow()
  })

  it("rejects target present without duration", () => {
    expect(() =>
      validateBuffDef({
        id: "test.bad",
        name: "Bad",
        trigger: baseTrigger,
        target: { kind: "self" },
        effects: [],
      }),
    ).toThrow(/target and duration must both be present/)
  })

  it("rejects duration present without target", () => {
    expect(() =>
      validateBuffDef({
        id: "test.bad",
        name: "Bad",
        trigger: baseTrigger,
        duration: { kind: "frames", v: 1 },
        effects: [],
      }),
    ).toThrow(/target and duration must both be present/)
  })

  it("rejects reaction with a stat effect", () => {
    expect(() =>
      validateBuffDef({
        id: "test.bad-stat",
        name: "Bad Stat Reaction",
        trigger: baseTrigger,
        effects: [
          {
            kind: "stat",
            path: { stat: "atkPct" },
            value: { kind: "const", v: 0.1 },
          },
        ],
      }),
    ).toThrow(/cannot have stat effects/)
  })

  it("rejects reaction with stacking", () => {
    expect(() =>
      validateBuffDef({
        id: "test.bad-stacking",
        name: "Bad Stacking Reaction",
        trigger: baseTrigger,
        effects: [
          {
            kind: "resource",
            resource: "forte",
            op: "add",
            value: { kind: "const", v: 1 },
          },
        ],
        stacking: { max: 2, onRetrigger: "addStackRefresh" },
      }),
    ).toThrow(/cannot declare stacking/)
  })

  it("rejects reaction with consumedBy", () => {
    expect(() =>
      validateBuffDef({
        id: "test.bad-consumed",
        name: "Bad ConsumedBy Reaction",
        trigger: baseTrigger,
        effects: [
          {
            kind: "resource",
            resource: "forte",
            op: "add",
            value: { kind: "const", v: 1 },
          },
        ],
        consumedBy: { event: "skillCast" },
      }),
    ).toThrow(/cannot declare consumedBy/)
  })

  it("rejects reaction with a root condition", () => {
    expect(() =>
      validateBuffDef({
        id: "test.bad-condition",
        name: "Bad Condition Reaction",
        trigger: baseTrigger,
        effects: [
          {
            kind: "resource",
            resource: "forte",
            op: "add",
            value: { kind: "const", v: 1 },
          },
        ],
        condition: { kind: "buffActive", buff: "x", on: "source" },
      }),
    ).toThrow(/cannot carry a root condition/)
  })
})
