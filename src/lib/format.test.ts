import { describe, expect, it } from "vitest"
import { compactDamage } from "./format"

describe("compactDamage", () => {
  it("renders sub-1k values as plain rounded integers (no forced decimals)", () => {
    expect(compactDamage(858)).toBe("858")
    expect(compactDamage(85)).toBe("85")
    expect(compactDamage(0)).toBe("0")
    expect(compactDamage(999)).toBe("999")
    expect(compactDamage(858.6)).toBe("859")
  })

  it("scales the k range to 3 significant figures", () => {
    expect(compactDamage(1_230)).toBe("1.23k")
    expect(compactDamage(12_300)).toBe("12.3k")
    expect(compactDamage(120_000)).toBe("120k")
    expect(compactDamage(458_200)).toBe("458k")
  })

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
