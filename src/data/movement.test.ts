import { describe, expect, it } from "vitest"
import { ALL_CHARACTERS } from "./characters/index"

describe("Movement injection into ALL_CHARACTERS", () => {
  it("every character has Dodge and Jump at the end of skills", () => {
    for (const char of ALL_CHARACTERS) {
      const lastTwo = char.skills.slice(-2)
      expect(lastTwo[0].name).toBe("Dodge")
      expect(lastTwo[1].name).toBe("Jump")
    }
  })

  it("Dodge appears before Jump for every character", () => {
    for (const char of ALL_CHARACTERS) {
      const dodgeIdx = char.skills.findIndex((s) => s.name === "Dodge")
      const jumpIdx = char.skills.findIndex((s) => s.name === "Jump")
      expect(dodgeIdx).toBeGreaterThan(-1)
      expect(jumpIdx).toBeGreaterThan(-1)
      expect(dodgeIdx).toBeLessThan(jumpIdx)
    }
  })
})
