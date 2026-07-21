// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assertAlignedTiers, deriveSetType } from "./extract-echo"

describe("deriveSetType", () => {
  it("reads 2 and 5 piece tiers as two-five", () => {
    expect(deriveSetType("Molten Rift", [2, 5])).toBe("two-five")
  })

  it("reads a lone 3 piece tier as three-only", () => {
    expect(deriveSetType("Thread of Severed Fate", [3])).toBe("three-only")
  })

  it("refuses tiers the loadout resolver cannot model", () => {
    expect(() => deriveSetType("Shadow of Shattered Dreams", [1])).toThrow(
      /unsupported piece tiers: 1/,
    )
  })
})

describe("assertAlignedTiers", () => {
  it("accepts ascending tiers matched one-to-one with descriptions", () => {
    expect(() =>
      assertAlignedTiers("Molten Rift", [2, 5], ["2pc text", "5pc text"]),
    ).not.toThrow()
  })

  it("refuses a description count that does not match the tiers", () => {
    expect(() =>
      assertAlignedTiers("Molten Rift", [2, 5], ["2pc text"]),
    ).toThrow(/2 piece tiers but 1 effect descriptions/)
  })

  it("refuses reordered tiers, which would pair descriptions with the wrong tier", () => {
    expect(() =>
      assertAlignedTiers("Molten Rift", [5, 2], ["5pc text", "2pc text"]),
    ).toThrow(/non-ascending piece tiers: 5,2/)
  })
})
