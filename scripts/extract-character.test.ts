import { describe, expect, it, vi } from "vitest"
import type { ApiDamageEntry, ApiSkillAttribute } from "./extract-character.js"
import {
  enrichSkill,
  mapSkillTreeBonuses,
  parseValuesFromValue,
} from "./extract-character.js"

describe("mapSkillTreeBonuses", () => {
  it("warns and skips unrecognized node titles", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(
      mapSkillTreeBonuses([
        { PropertyNodeTitle: "Mystery Stat Up+" },
        { PropertyNodeTitle: "ATK+" },
      ]),
    ).toEqual(["ATK"])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[skill-tree]"))
    warn.mockRestore()
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

describe("parseValuesFromValue", () => {
  it("parses single-hit with leading flat: '950+23.80%'", () => {
    expect(parseValuesFromValue("950+23.80%")).toEqual({
      flat: 950,
      rates: [{ value: 0.238, count: 1 }],
    })
  })

  it("does not misparse multi-hit without flat: '35.79%*3+71.58%'", () => {
    expect(parseValuesFromValue("35.79%*3+71.58%")).toEqual({
      flat: undefined,
      rates: [
        { value: 0.3579, count: 3 },
        { value: 0.7158, count: 1 },
      ],
    })
  })

  it("parses value with no flat and no rates", () => {
    expect(parseValuesFromValue("Staggers target")).toEqual({
      flat: undefined,
      rates: [],
    })
  })
})

function makeApiDamageEntry(
  value: string,
  type = "Basic Attack",
): ApiDamageEntry {
  return {
    EntryNumber: 0,
    Id: 0,
    Condition: "",
    Type: type,
    DmgType: "damage",
    PropertyName: "ATK",
    RateLv: Array(10).fill(value),
    Energy: Array(10).fill(0),
    ElementPower: Array(10).fill(0),
    ToughLv: Array(10).fill(0),
    WeaknessLvl: Array(10).fill(0),
  }
}

function makeApiSkillAttribute(
  attributeName: string,
  value: string,
): ApiSkillAttribute {
  return {
    attributeId: 0,
    attributeName,
    values: Array(10).fill(value),
    Description: "",
  }
}

describe("enrichSkill flat attachment", () => {
  it("attaches flat to the first matched damage entry", () => {
    const result = enrichSkill(
      [makeApiSkillAttribute("Healing", "950+23.80%")],
      [makeApiDamageEntry("23.80%")],
      "Normal Attack",
    )
    expect(result.stages[0].damage?.[0].flat).toBe(950)
  })

  it("warns when flat is present alongside multiple matched entries", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    enrichSkill(
      [makeApiSkillAttribute("Healing", "950+23.80%*2")],
      [makeApiDamageEntry("23.80%"), makeApiDamageEntry("23.80%")],
      "Normal Attack",
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[flat]"))
    warn.mockRestore()
  })
})
