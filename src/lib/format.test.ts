// @vitest-environment node
import { describe, expect, it } from "vitest"
import { compactDamage } from "./format"

describe("compactDamage", () => {
  it("scales the M range to 3 significant figures, including forced trailing zeros", () => {
    expect(compactDamage(2_530_000)).toBe("2.53M")
    expect(compactDamage(12_300_000)).toBe("12.3M")
    expect(compactDamage(125_000_000)).toBe("125M")
    expect(compactDamage(2_500_000)).toBe("2.50M")
  })

  it("rolls a value up across a unit boundary instead of rendering 1.00e+3k", () => {
    expect(compactDamage(999_999)).toBe("1.00M")
    expect(compactDamage(999_500)).toBe("1.00M")
    expect(compactDamage(999_499)).toBe("999k")
  })
})
