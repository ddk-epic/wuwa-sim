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
  priorGate: 0,
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

  it("appends pad/fall in order, joined by ' · '", () => {
    const f = formatPaddingDelay(delay({ floor: 30, pad: 6, fall: 21 }))
    expect(f!.tooltip).toBe(
      `floor: ${formatFrames(30)} · pad: ${formatFrames(6)} · fall: ${formatFrames(21)}`,
    )
    expect(f!.total).toBe(57)
  })

  it("total sums the action-cost fields, excluding the swapBack/priorGate floors", () => {
    const f = formatPaddingDelay(
      delay({ react: 9, pad: 1, fall: 2, swapBack: 3, priorGate: 4 }),
    )
    expect(f!.total).toBe(12)
  })

  it("the start floors (swapBack, priorGate) alone → null — surfaced by WaitBadge", () => {
    expect(formatPaddingDelay(delay({ priorGate: 43 }))).toBeNull()
    expect(formatPaddingDelay(delay({ swapBack: 30 }))).toBeNull()
    expect(
      formatPaddingDelay(delay({ swapBack: 30, priorGate: 43 })),
    ).toBeNull()
  })
})
