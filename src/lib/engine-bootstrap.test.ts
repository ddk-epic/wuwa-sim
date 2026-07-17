// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import { bootstrapSlot, validateBuffDef } from "./engine-bootstrap"

let testChar: EnrichedCharacter | null = null

vi.mock("./loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testChar && testChar.id === id ? testChar : null,
  getEchoById: () => null,
  getEchoSetById: () => null,
  getWeaponById: () => null,
}))

afterEach(() => {
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

describe("bootstrapSlot — self wielder-id filter", () => {
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
})

describe("validateBuffDef", () => {
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
})
