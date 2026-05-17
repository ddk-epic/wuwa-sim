import { describe, expect, it } from "vitest"
import { formatSkillType } from "./skill-types"

describe("formatSkillType", () => {
  it.each([
    ["Basic Attack", "BASIC"],
    ["Heavy Attack", "HEAVY"],
    ["Resonance Skill", "SKILL"],
    ["Resonance Liberation", "LIBER"],
    ["Forte Circuit", "FORTE"],
    ["Intro Skill", "INTRO"],
    ["Outro Skill", "OUTRO"],
    ["Echo Skill", "ECHO"],
    ["Movement", "MOVE"],
  ])("maps %s → %s", (input, expected) => {
    expect(formatSkillType(input)).toBe(expected)
  })

  it("returns raw string for unknown input", () => {
    expect(formatSkillType("Coordinated Attack")).toBe("Coordinated Attack")
    expect(formatSkillType("")).toBe("")
  })
})
