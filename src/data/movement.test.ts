// @vitest-environment node
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
})
