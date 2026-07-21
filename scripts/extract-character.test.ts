// @vitest-environment node
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

  it("deduplicates identical stat names", () => {
    expect(
      mapSkillTreeBonuses([
        { PropertyNodeTitle: "ATK+" },
        { PropertyNodeTitle: "ATK+" },
        { PropertyNodeTitle: "Fusion DMG Bonus+" },
      ]),
    ).toEqual(["ATK", "Fusion DMG Bonus"])
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
})

function makeApiDamageEntry(
  value: string,
  type = "Basic Attack",
  id = 0,
  energy = 0,
): ApiDamageEntry {
  return {
    EntryNumber: 0,
    Id: id,
    Condition: "",
    Type: type,
    DmgType: "damage",
    PropertyName: "ATK",
    RateLv: Array(10).fill(value),
    Energy: Array(10).fill(energy),
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

describe("enrichSkill stage-scoped hit assignment", () => {
  // Two stages share the 1.86% rate but with different energy. Grouping by
  // hit-block Id keeps each stage on its own hits: the first stage must not
  // consume the second stage's 1.86% block, and the second stage must still
  // find its own.
  it("does not let one stage steal another stage's identically-rated hit", () => {
    const result = enrichSkill(
      [
        makeApiSkillAttribute("Answer Waves", "1.86%*4+17.36%"),
        makeApiSkillAttribute("May Tempest", "1.86%*2+7.03%*3"),
      ],
      [
        makeApiDamageEntry("1.86%", "Resonance Skill", 140925101, 0.18),
        makeApiDamageEntry("0%", "Resonance Skill", 140925102, 0),
        makeApiDamageEntry("17.36%", "Resonance Skill", 140925103, 1.61),
        makeApiDamageEntry("1.86%", "Resonance Skill", 140925201, 0.66),
        makeApiDamageEntry("0%", "Resonance Skill", 140925202, 0),
        makeApiDamageEntry("7.03%", "Resonance Skill", 140925221, 2.5),
        makeApiDamageEntry("0%", "Resonance Skill", 140925222, 0),
      ],
      "Forte Circuit",
    )

    const answerWaves = result.stages[0].damage ?? []
    expect(answerWaves.map((d) => d.value)).toEqual([
      0.0186, 0.0186, 0.0186, 0.0186, 0.1736,
    ])
    // All four 1.86% hits are the stage's own 0.18-energy block, not the
    // other stage's 0.66 block.
    expect(answerWaves.slice(0, 4).map((d) => d.energy)).toEqual([
      0.18, 0.18, 0.18, 0.18,
    ])

    const mayTempest = result.stages[1].damage ?? []
    expect(mayTempest.map((d) => d.value)).toEqual([
      0.0186, 0.0186, 0.0703, 0.0703, 0.0703,
    ])
    expect(mayTempest.slice(0, 2).map((d) => d.energy)).toEqual([0.66, 0.66])
  })

  it("warns when a stage's rate finds no hit in its own group", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    enrichSkill(
      [makeApiSkillAttribute("Ghost", "5.00%*2")],
      [makeApiDamageEntry("9.99%", "Resonance Skill", 140925101, 0)],
      "Forte Circuit",
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[miss]"))
    warn.mockRestore()
  })
})
