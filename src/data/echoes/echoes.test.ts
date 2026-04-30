import { describe, expect, it } from "vitest"
import { impermanenceHeron } from "./impermanence-heron"
import { infernoRider } from "./inferno-rider"

describe("impermanenceHeron echo data", () => {
  it("Tap stage has parenthesised newName", () => {
    const tap = impermanenceHeron.skill.stages.find((s) => s.name === "Tap")
    expect(tap?.newName).toBe("")
  })

  it("Hold stage has parenthesised newName and hidden: true", () => {
    const hold = impermanenceHeron.skill.stages.find((s) => s.name === "Hold")
    expect(hold?.newName).toBe("(Hold)")
    expect(hold?.hidden).toBe(true)
  })
})

describe("infernoRider echo data", () => {
  it("Tap stage has parenthesised newName", () => {
    const tap = infernoRider.skill.stages.find((s) => s.name === "Tap")
    expect(tap?.newName).toBe("")
  })

  it("Hold stage has parenthesised newName and hidden: true", () => {
    const hold = infernoRider.skill.stages.find((s) => s.name === "Hold")
    expect(hold?.newName).toBe("(Hold)")
    expect(hold?.hidden).toBe(true)
  })
})
