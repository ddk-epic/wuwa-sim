import { describe, expect, it } from "vitest"
import type { DelayBreakdown } from "#/types/simulation-log"
import { formatFrames } from "#/lib/format"
import { formatPaddingDelay } from "./DelayBadge"

const delay = (
  pad: Partial<DelayBreakdown["pad"]> = {},
  wait = 0,
): DelayBreakdown => ({
  pad: { reaction: 0, floor: 0, trailing: 0, fall: 0, ...pad },
  wait,
})

describe("formatPaddingDelay", () => {
  it("all-zero → null", () => {
    expect(formatPaddingDelay(delay())).toBeNull()
  })

  it("floor>0 suppresses react in the tooltip but both sum into total", () => {
    const f = formatPaddingDelay(delay({ floor: 15, reaction: 9 }))
    expect(f).not.toBeNull()
    expect(f!.total).toBe(24)
    expect(f!.tooltip).toBe(`floor: ${formatFrames(15)}`)
    expect(f!.tooltip).not.toContain("react")
  })

  it("shows react when floor === 0", () => {
    const f = formatPaddingDelay(delay({ reaction: 9 }))
    expect(f!.tooltip).toBe(`react: ${formatFrames(9)}`)
  })

  it("appends pad/fall in order, joined by ' · '", () => {
    const f = formatPaddingDelay(delay({ floor: 30, trailing: 6, fall: 21 }))
    expect(f!.tooltip).toBe(
      `floor: ${formatFrames(30)} · pad: ${formatFrames(6)} · fall: ${formatFrames(21)}`,
    )
    expect(f!.total).toBe(57)
  })

  it("total sums the action-cost pad fields, excluding the wait floor", () => {
    const f = formatPaddingDelay(
      delay({ reaction: 9, trailing: 1, fall: 2 }, 7),
    )
    expect(f!.total).toBe(12)
  })

  it("the wait floor alone → null — surfaced by WaitBadge", () => {
    expect(formatPaddingDelay(delay({}, 43))).toBeNull()
  })
})
