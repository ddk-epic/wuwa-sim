// @vitest-environment node
import { describe, expect, it } from "vitest"
import { slugify } from "./slugify"

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Inferno Rider")).toBe("inferno-rider")
  })

  it("drops an intra-word apostrophe", () => {
    expect(slugify("Defier's Thorn")).toBe("defiers-thorn")
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

  it("refuses a name that slugs to nothing", () => {
    expect(() => slugify("鳴潮")).toThrow(/no sluggable characters/)
  })
})
