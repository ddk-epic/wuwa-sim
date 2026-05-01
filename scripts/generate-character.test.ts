import { describe, expect, it } from "vitest"
import type { Character } from "../src/types/character.js"
import { formatCharacter } from "./generate-character.js"

const minimalChar: Character = {
  id: 1,
  name: "Test Hero",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "SR",
  stats: {
    base: { hp: 100, atk: 10, def: 20 },
    max: { hp: 1000, atk: 100, def: 200 },
  },
  skills: [],
  skillTreeBonuses: [],
  buffs: { inherent: [], resonanceChain: [] },
}

const charWithBonuses: Character = {
  ...minimalChar,
  skillTreeBonuses: ["Fusion DMG Bonus", "ATK"],
  buffs: {
    inherent: ["Passive A", "Passive B"],
    resonanceChain: ["Chain 1", "Chain 2"],
  },
}

describe("formatCharacter", () => {
  it("emits the character id", () => {
    const out = formatCharacter(minimalChar, "testHero")
    expect(out).toContain("id: 1,")
  })

  it("uses the provided variable name", () => {
    const out = formatCharacter(minimalChar, "testHero")
    expect(out).toContain("export const testHero =")
  })

  it("satisfies EnrichedCharacter", () => {
    const out = formatCharacter(minimalChar, "testHero")
    expect(out).toContain("satisfies EnrichedCharacter")
  })

  it("emits a template block with empty string placeholders", () => {
    const out = formatCharacter(minimalChar, "testHero")
    expect(out).toContain("template: {")
    expect(out).toContain("weapon: '',")
    expect(out).toContain("echo: '',")
    expect(out).toContain("echoSet: '',")
  })

  it("emits empty skillTreeBonuses array when none present", () => {
    const out = formatCharacter(minimalChar, "testHero")
    expect(out).toContain("skillTreeBonuses: [")
  })

  it("emits skillTreeBonuses values from the character", () => {
    const out = formatCharacter(charWithBonuses, "testHero")
    expect(out).toContain('"Fusion DMG Bonus",')
    expect(out).toContain('"ATK",')
  })

  it("emits empty buffs when none present", () => {
    const out = formatCharacter(minimalChar, "testHero")
    expect(out).toContain("buffs: {")
    expect(out).toContain("inherent: [")
    expect(out).toContain("resonanceChain: [")
  })

  it("emits buffs.inherent values from the character", () => {
    const out = formatCharacter(charWithBonuses, "testHero")
    expect(out).toContain('"Passive A",')
    expect(out).toContain('"Passive B",')
  })

  it("emits buffs.resonanceChain values from the character", () => {
    const out = formatCharacter(charWithBonuses, "testHero")
    expect(out).toContain('"Chain 1",')
    expect(out).toContain('"Chain 2",')
  })

  it("emits stats base and max", () => {
    const out = formatCharacter(minimalChar, "testHero")
    expect(out).toContain("base: { hp: 100, atk: 10, def: 20 }")
    expect(out).toContain("max: { hp: 1000, atk: 100, def: 200 }")
  })
})
