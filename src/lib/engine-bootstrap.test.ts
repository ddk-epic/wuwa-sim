import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho, EchoSet } from "#/types/echo"
import type { WeaponData } from "#/types/weapon"
import {
  buildCharacterBuffDefs,
  buildEchoBuffDefs,
  buildEchoSetBuffDefs,
  buildWeaponBuffDefs,
} from "./engine-bootstrap"

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
