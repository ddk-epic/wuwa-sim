import { describe, expect, it } from "vitest"
import { mapSkillTreeBonuses } from "./extract-character.js"

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
