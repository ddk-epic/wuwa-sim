import { describe, expect, it } from "vitest"
import { formatFrames } from "./format"

describe("formatFrames", () => {
  it("converts integer frames to seconds string", () => {
    expect(formatFrames(60)).toBe("1.00s")
    expect(formatFrames(120)).toBe("2.00s")
    expect(formatFrames(90)).toBe("1.50s")
  })

  it("handles zero", () => {
    expect(formatFrames(0)).toBe("0.00s")
  })

  it("truncates to 2 decimal places", () => {
    expect(formatFrames(1)).toBe("0.02s")
    expect(formatFrames(7)).toBe("0.12s")
  })
})
