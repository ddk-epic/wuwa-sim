import { describe, expect, it } from "vitest"
import { slugify } from "./slugify"

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Inferno Rider")).toBe("inferno-rider")
  })

  it("drops apostrophes and colons", () => {
    expect(slugify("Defier's Thorn")).toBe("defiers-thorn")
    expect(slugify("Reminiscence: Fleurdelys")).toBe("reminiscence-fleurdelys")
  })

  it("keeps the vowel of an accented letter", () => {
    expect(slugify("Jué")).toBe("jue")
  })

  it("collapses runs left by stripped separators", () => {
    expect(slugify("Reminiscence - Nightmare: Adam Smasher")).toBe(
      "reminiscence-nightmare-adam-smasher",
    )
  })

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  Void Thunder  ")).toBe("void-thunder")
  })
})
