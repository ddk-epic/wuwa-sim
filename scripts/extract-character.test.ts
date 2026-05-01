import { describe, expect, it } from "vitest"
import { mapSkillTreeBonuses, mapBuffs } from "./extract-character.js"

describe("mapSkillTreeBonuses", () => {
  it("returns empty array for no nodes", () => {
    expect(mapSkillTreeBonuses([])).toEqual([])
  })

  it("strips trailing + from PropertyNodeTitle", () => {
    expect(
      mapSkillTreeBonuses([{ PropertyNodeTitle: "Fusion DMG Bonus+" }]),
    ).toEqual(["Fusion DMG Bonus"])
  })

  it("deduplicates identical stat names", () => {
    expect(
      mapSkillTreeBonuses([
        { PropertyNodeTitle: "ATK+" },
        { PropertyNodeTitle: "ATK+" },
        { PropertyNodeTitle: "Fusion DMG Bonus+" },
      ]),
    ).toEqual(["ATK", "Fusion DMG Bonus"])
  })

  it("ignores nodes with no PropertyNodeTitle", () => {
    expect(mapSkillTreeBonuses([{}, { PropertyNodeTitle: "DEF+" }])).toEqual([
      "DEF",
    ])
  })
})

describe("mapBuffs", () => {
  const inherentSkill = {
    SkillId: 1,
    SkillType: "Inherent Skill",
    SkillName: "Passive A",
    SkillAttributes: [],
    DamageList: [],
  }
  const resonanceSkill = {
    SkillId: 2,
    SkillType: "Resonance Skill",
    SkillName: "Active",
    SkillAttributes: [],
    DamageList: [],
  }

  it("returns empty buffs for empty inputs", () => {
    expect(mapBuffs([], [])).toEqual({ inherent: [], resonanceChain: [] })
  })

  it("inherent contains only Inherent Skill names", () => {
    const result = mapBuffs([inherentSkill, resonanceSkill], [])
    expect(result.inherent).toEqual(["Passive A"])
  })

  it("resonanceChain is sorted by GroupIndex", () => {
    const chain = [
      { NodeName: "Chain C", GroupIndex: 3 },
      { NodeName: "Chain A", GroupIndex: 1 },
      { NodeName: "Chain B", GroupIndex: 2 },
    ]
    const result = mapBuffs([], chain)
    expect(result.resonanceChain).toEqual(["Chain A", "Chain B", "Chain C"])
  })
})
