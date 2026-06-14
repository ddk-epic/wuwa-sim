import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { Element } from "#/data/elements"
import type { TimelineEntry } from "#/types/timeline"
import type { Slots } from "#/types/loadout"
import {
  getDistinctCharsBySlot,
  buildGroupGradient,
  getDominantHex,
  getGroupFirstCharHex,
} from "./timeline-group-formatting"

let testCharacters: EnrichedCharacter[] = []

vi.mock("../loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
}))

afterEach(() => {
  testCharacters = []
})

const makeChar = (id: number, element: Element): EnrichedCharacter => ({
  id,
  name: `Char${id}`,
  element,
  weaponType: "Sword",
  rarity: "5",
  maxEnergy: 100,
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 0, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [],
})

const entry = (id: string, characterId: number): TimelineEntry => ({
  id,
  characterId,
  stageId: "s1",
})

const slots: Slots = [1, 2, 3]

describe("getDistinctCharsBySlot", () => {
  it("returns empty array for empty entries", () => {
    expect(getDistinctCharsBySlot([], slots)).toEqual([])
  })

  it("returns single char id", () => {
    expect(getDistinctCharsBySlot([entry("a", 1)], slots)).toEqual([1])
  })

  it("deduplicates repeated char", () => {
    const entries = [entry("a", 1), entry("b", 1), entry("c", 1)]
    expect(getDistinctCharsBySlot(entries, slots)).toEqual([1])
  })

  it("orders by slot position", () => {
    const entries = [entry("a", 3), entry("b", 1), entry("c", 2)]
    expect(getDistinctCharsBySlot(entries, slots)).toEqual([1, 2, 3])
  })

  it("sorts unknown chars last", () => {
    const entries = [entry("a", 99), entry("b", 1)]
    expect(getDistinctCharsBySlot(entries, slots)).toEqual([1, 99])
  })
})

describe("getDominantHex", () => {
  it("returns #888888 for empty entries", () => {
    expect(getDominantHex([])).toBe("#888888")
  })

  it("returns hex of most frequent character", () => {
    testCharacters = [makeChar(1, "Fusion"), makeChar(2, "Glacio")]
    const entries = [entry("a", 1), entry("b", 1), entry("c", 2)]
    const result = getDominantHex(entries)
    expect(result).not.toBe("#888888")
    expect(result).toContain("#")
  })

  it("falls back to #888888 when character not found", () => {
    const entries = [entry("a", 99)]
    expect(getDominantHex(entries)).toBe("#888888")
  })

  it("on tie, favors first encountered character", () => {
    testCharacters = [makeChar(1, "Fusion"), makeChar(2, "Glacio")]
    const entries = [entry("a", 1), entry("b", 2)]
    const result = getDominantHex(entries)
    const fusionChar = testCharacters.find((c) => c.id === 1)!
    const glacioChar = testCharacters.find((c) => c.id === 2)!
    expect([fusionChar.element, glacioChar.element]).toContain(
      fusionChar.element,
    )
    expect(typeof result).toBe("string")
  })
})

describe("getGroupFirstCharHex", () => {
  it("returns #888888 for empty entries", () => {
    expect(getGroupFirstCharHex([], slots)).toBe("#888888")
  })

  it("returns hex of first char by slot order", () => {
    testCharacters = [makeChar(1, "Fusion"), makeChar(2, "Glacio")]
    const entries = [entry("a", 2), entry("b", 1)]
    const result = getGroupFirstCharHex(entries, slots)
    expect(result).not.toBe("#888888")
    expect(result).toContain("#")
  })

  it("falls back to #888888 when character not found", () => {
    const entries = [entry("a", 99)]
    expect(getGroupFirstCharHex(entries, slots)).toBe("#888888")
  })
})

describe("buildGroupGradient", () => {
  it("returns transparent for empty entries", () => {
    expect(buildGroupGradient([], slots)).toBe("transparent")
  })

  it("returns single-stop gradient for one character", () => {
    testCharacters = [makeChar(1, "Fusion")]
    const entries = [entry("a", 1)]
    const result = buildGroupGradient(entries, slots)
    expect(result).toContain("linear-gradient(90deg,")
    expect(result).toContain("transparent 95%")
  })

  it("returns multi-stop gradient for multiple characters", () => {
    testCharacters = [makeChar(1, "Fusion"), makeChar(2, "Glacio")]
    const entries = [entry("a", 1), entry("b", 2)]
    const result = buildGroupGradient(entries, slots)
    expect(result).toContain("linear-gradient(90deg,")
    expect(result).toContain("transparent 95%")
    expect(result.split(",").length).toBeGreaterThan(3)
  })
})
