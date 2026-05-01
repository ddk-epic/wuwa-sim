import { describe, expect, it } from "vitest"
import type { Character } from "../src/types/character.js"
import { deriveNewName, formatCharacter } from "./generate-character.js"

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

const charWithSkills: Character = {
  ...minimalChar,
  skills: [
    {
      id: 1,
      name: "Strike",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage 1 DMG",
          value: "50%",
          damage: [],
        },
        {
          name: "Woolies Damage",
          value: "100%",
          damage: [],
        },
        {
          name: "Skill DMG",
          value: "80%",
          damage: [],
        },
        {
          name: "Dodge Counter DMG",
          value: "120%",
          damage: [],
        },
        {
          name: "Mid-air Attack",
          value: "90%",
          damage: [],
        },
      ],
      damage: [],
    },
    {
      id: 2,
      name: "Passive A",
      type: "Inherent Skill",
      stages: [],
      damage: [],
    },
    {
      id: 3,
      name: "Outro",
      type: "Outro Skill",
      stages: [],
      damage: [],
    },
  ],
}

describe("deriveNewName", () => {
  it("strips ' DMG' suffix", () => {
    expect(deriveNewName("Stage 1 DMG")).toBe("Stage 1")
  })

  it("strips ' Damage' suffix", () => {
    expect(deriveNewName("Woolies Damage")).toBe("Woolies")
  })

  it("returns '' for exactly 'Skill DMG'", () => {
    expect(deriveNewName("Skill DMG")).toBe("")
  })

  it("returns name unchanged when no known suffix", () => {
    expect(deriveNewName("Mid-air Attack")).toBe("Mid-air Attack")
  })

  it("strips ' DMG' from compound names", () => {
    expect(deriveNewName("Cosmos: Frolicking Stage 1 DMG")).toBe(
      "Cosmos: Frolicking Stage 1",
    )
  })
})

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

  it("derives newName by stripping ' DMG' from stage name", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    expect(out).toContain('newName: "Stage 1",')
  })

  it("derives newName by stripping ' Damage' from stage name", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    expect(out).toContain('newName: "Woolies",')
  })

  it("sets newName to '' for stage named 'Skill DMG'", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    expect(out).toContain("newName: '',")
  })

  it("leaves newName unchanged when no known suffix", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    expect(out).toContain('newName: "Mid-air Attack",')
  })

  it("emits hidden: true for stages with 'Dodge Counter' in name", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    expect(out).toContain("hidden: true,")
  })

  it("does not emit hidden field for non-Dodge-Counter stages", () => {
    const stageOnlyChar: Character = {
      ...minimalChar,
      skills: [
        {
          id: 1,
          name: "Strike",
          type: "Normal Attack",
          stages: [{ name: "Stage 1 DMG", value: "50%", damage: [] }],
          damage: [],
        },
      ],
    }
    const out = formatCharacter(stageOnlyChar, "testHero")
    expect(out).not.toContain("hidden: true,")
  })

  it("emits hidden: true for Inherent Skill type", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    const inherentIdx = out.indexOf('"Inherent Skill"')
    const hiddenIdx = out.indexOf("hidden: true,", inherentIdx)
    expect(hiddenIdx).toBeGreaterThan(inherentIdx)
  })

  it("never emits '// hidden: true' comments", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    expect(out).not.toContain("// hidden: true")
  })

  it("emits exactly one placeholder stage for Outro Skill", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    const outroIdx = out.indexOf('"Outro Skill"')
    const outroSection = out.slice(outroIdx)
    expect(outroSection).toContain('name: "Outro DMG",')
    expect(outroSection).toContain("newName: '',")
    expect(outroSection).toContain('value: "0%",')
    expect(outroSection).toContain("actionTime: 0,")
    expect(outroSection).toContain("damage: [],")
  })
})
