import { describe, it, expect } from "vitest"
import { sanhua } from "./sanhua"
import { encore } from "./encore"

describe("encore template", () => {
  it("has correct weapon, echo, and echoSet names", () => {
    expect(encore.template).toEqual({
      weapon: "Stringmaster",
      echo: "Inferno Rider",
      echoSet: "Molten Rift",
    })
  })
})

describe("sanhua template", () => {
  it("has correct weapon, echo, and echoSet names", () => {
    expect(sanhua.template).toEqual({
      weapon: "Emerald of Genesis",
      echo: "Impermanence Heron",
      echoSet: "Moonlit Clouds",
    })
  })
})

describe("sanhua outro skill", () => {
  const outroSkill = sanhua.skills.find((s) => s.type === "Outro Skill")

  it("has exactly one stage", () => {
    expect(outroSkill?.stages).toHaveLength(1)
  })

  it("stage is named Outro DMG with correct shape", () => {
    const stage = outroSkill?.stages[0]
    expect(stage?.name).toBe("Outro DMG")
    expect(stage?.newName).toBe("")
    expect(stage?.value).toBe("0%")
    expect(stage?.actionTime).toBe(0)
    expect(stage?.damage).toEqual([])
  })
})

describe("encore outro skill", () => {
  const outroSkill = encore.skills.find((s) => s.type === "Outro Skill")

  it("has exactly one stage", () => {
    expect(outroSkill?.stages).toHaveLength(1)
  })

  it("stage is named Outro DMG with correct shape", () => {
    const stage = outroSkill?.stages[0]
    expect(stage?.name).toBe("Outro DMG")
    expect(stage?.newName).toBe("")
    expect(stage?.value).toBe("0%")
    expect(stage?.actionTime).toBe(0)
    expect(stage?.damage).toEqual([])
  })
})
