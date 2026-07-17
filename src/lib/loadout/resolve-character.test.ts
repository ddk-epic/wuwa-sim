// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import { resolveCharacterBuffs } from "./resolve-character"

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

describe("resolveCharacterBuffs", () => {
  it("includes all char buffs when sequence gate is 0", () => {
    const buff = simStartPermanentBuff("char.buff")
    const char = baseChar({ buffs: [buff] })
    expect(resolveCharacterBuffs(char, 0)).toContainEqual(buff)
  })

  it("includes buffs when requiresSequence and maxSequence both satisfied", () => {
    const buff: BuffDef = {
      ...simStartPermanentBuff("s1-only.buff"),
      requiresSequence: 1,
      maxSequence: 2,
    }
    const char = baseChar({ buffs: [buff] })
    expect(resolveCharacterBuffs(char, 0)).toHaveLength(0)
    expect(resolveCharacterBuffs(char, 1)).toHaveLength(1)
    expect(resolveCharacterBuffs(char, 2)).toHaveLength(1)
    expect(resolveCharacterBuffs(char, 3)).toHaveLength(0)
  })

  it("compiles skill-tree Crit. Rate node into a buff def", () => {
    const char = baseChar({ skillTreeBonuses: ["Crit. Rate"] })
    const defs = resolveCharacterBuffs(char, 0)
    expect(defs).toHaveLength(1)
    expect(defs[0].effects[0]).toMatchObject({
      kind: "stat",
      path: { stat: "critRate" },
    })
  })

  it("compiles skill-tree element bonus node into a buff def", () => {
    const char = baseChar({ skillTreeBonuses: ["Fusion DMG Bonus"] })
    const defs = resolveCharacterBuffs(char, 0)
    expect(defs).toHaveLength(1)
    expect(defs[0].effects[0]).toMatchObject({
      path: { stat: "elementBonus", key: "Fusion" },
    })
  })
})
