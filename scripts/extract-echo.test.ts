import { describe, expect, it } from "vitest"
import { deriveSetType } from "./extract-echo"

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
