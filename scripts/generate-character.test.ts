// @vitest-environment node
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
          category: "Basic Attack",
          value: "50%",
          damage: [],
        },
        {
          name: "Woolies Damage",
          category: "Basic Attack",
          value: "100%",
          damage: [],
        },
        {
          name: "Skill DMG",
          category: "Basic Attack",
          value: "80%",
          damage: [],
        },
        {
          name: "Dodge Counter DMG",
          category: "Basic Attack",
          value: "120%",
          damage: [],
        },
        {
          name: "Mid-air Attack",
          category: "Basic Attack",
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
    {
      id: 4,
      name: "Cosmos Rave",
      type: "Resonance Liberation",
      resonanceCost: 125,
      stages: [
        {
          name: "Cosmos: Frolicking Stage 1 DMG",
          category: "Basic Attack",
          value: "90%",
          damage: [],
        },
      ],
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
})

describe("formatCharacter", () => {
  it("emits skillTreeBonuses values from the character", () => {
    const out = formatCharacter(charWithBonuses, "testHero")
    expect(out).toContain('"Fusion DMG Bonus",')
    expect(out).toContain('"ATK",')
  })

  it("captures maxEnergy from the liberation skill's resonanceCost", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    expect(out).toContain("maxEnergy: 125,")
  })

  it("scaffolds skillBonusPriority, defaulting when absent", () => {
    const out = formatCharacter(minimalChar, "testHero")
    expect(out).toContain('skillBonusPriority: "Resonance Liberation",')
  })

  it("emits skillBonusPriority from the character when present", () => {
    const out = formatCharacter(
      { ...minimalChar, skillBonusPriority: "Heavy Attack" },
      "testHero",
    )
    expect(out).toContain('skillBonusPriority: "Heavy Attack",')
  })

  it("derives newName from stage name via deriveNewName", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    expect(out).toContain('newName: "Stage 1",')
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
          stages: [
            {
              name: "Stage 1 DMG",
              category: "Basic Attack",
              value: "50%",
              damage: [],
            },
          ],
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

  it("prepends a cast activation stage for Resonance Liberation skills", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    const libIdx = out.indexOf('type: "Resonance Liberation"')
    const libSection = out.slice(libIdx)
    const castStageIdx = libSection.indexOf('name: "Skill DMG",')
    const firstRawStageIdx = libSection.indexOf(
      'name: "Cosmos: Frolicking Stage 1 DMG",',
    )
    expect(castStageIdx).toBeGreaterThan(-1)
    expect(castStageIdx).toBeLessThan(firstRawStageIdx)
    expect(libSection.slice(castStageIdx)).toContain('newName: "Cosmos Rave",')
  })

  it("does not prepend a cast stage for Resonance Liberation when 'Skill DMG' stage exists", () => {
    const charWithCastStage: Character = {
      ...minimalChar,
      skills: [
        {
          id: 4,
          name: "Cosmos Rave",
          type: "Resonance Liberation",
          stages: [
            {
              name: "Skill DMG",
              category: "Basic Attack",
              value: "100%",
              damage: [],
            },
            {
              name: "Cosmos: Frolicking Stage 1 DMG",
              category: "Basic Attack",
              value: "90%",
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    }
    const out = formatCharacter(charWithCastStage, "testHero")
    const libIdx = out.indexOf('type: "Resonance Liberation"')
    const libSection = out.slice(libIdx)
    // "Cosmos Rave" as a synthetic cast stage should not appear
    expect(libSection).not.toContain('name: "Cosmos Rave",')
  })

  it("emits a placeholder stage for Outro Skill", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    const outroSection = out.slice(out.indexOf('"Outro Skill"'))
    expect(outroSection).toContain('name: "Outro DMG",')
  })

  it("emits flat: line in damage entry when flat is defined", () => {
    const charWithFlat: Character = {
      ...minimalChar,
      skills: [
        {
          id: 1,
          name: "Heal",
          type: "Resonance Skill",
          stages: [
            {
              name: "Healing",
              category: "Basic Attack",
              value: "950+23.80%",
              damage: [
                {
                  type: "Resonance Skill",
                  dmgType: "Heal",
                  scalingStat: "ATK",
                  actionFrame: 0,
                  flat: 950,
                  value: 0.238,
                  energy: 0,
                  concerto: 0,
                  toughness: 0,
                  weakness: 0,
                },
              ],
            },
          ],
          damage: [],
        },
      ],
    }
    const out = formatCharacter(charWithFlat, "testHero")
    expect(out).toContain("flat: 950,")
  })

  it("does not emit flat: line when flat is undefined", () => {
    const out = formatCharacter(charWithSkills, "testHero")
    expect(out).not.toContain("flat:")
  })
})
