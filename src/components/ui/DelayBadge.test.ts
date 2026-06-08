import { describe, expect, it } from "vitest"
import type { DelayBreakdown } from "#/types/simulation-log"
import { formatFrames } from "#/lib/format"
import { formatPaddingDelay } from "./DelayBadge"

const delay = (over: Partial<DelayBreakdown> = {}): DelayBreakdown => ({
  react: 0,
  floor: 0,
  pad: 0,
  fall: 0,
  swapBack: 0,
  ...over,
})

describe("formatPaddingDelay", () => {
  it("all-zero → null", () => {
    expect(formatPaddingDelay(delay())).toBeNull()
  })

  it("floor>0 suppresses react in the tooltip but both sum into total", () => {
    const f = formatPaddingDelay(delay({ floor: 15, react: 9 }))
    expect(f).not.toBeNull()
    expect(f!.total).toBe(24)
    expect(f!.tooltip).toBe(`floor: ${formatFrames(15)}`)
    expect(f!.tooltip).not.toContain("react")
  })

  it("shows react when floor === 0", () => {
    const f = formatPaddingDelay(delay({ react: 9 }))
    expect(f!.tooltip).toBe(`react: ${formatFrames(9)}`)
  })

  it("appends pad/fall/swap-back in order, joined by ' · '", () => {
    const f = formatPaddingDelay(
      delay({ floor: 30, pad: 6, fall: 21, swapBack: 6 }),
    )
    expect(f!.tooltip).toBe(
      `floor: ${formatFrames(30)} · pad: ${formatFrames(6)} · fall: ${formatFrames(21)} · swap-back: ${formatFrames(6)}`,
    )
    expect(f!.total).toBe(63)
  })

  it("total is the sum of all five fields", () => {
    const f = formatPaddingDelay(
      delay({ react: 9, pad: 1, fall: 2, swapBack: 3 }),
    )
    expect(f!.total).toBe(15)
  })
})
