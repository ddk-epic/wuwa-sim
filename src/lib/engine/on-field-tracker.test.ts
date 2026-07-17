// @vitest-environment node
import { describe, expect, it } from "vitest"
import { OnFieldTracker } from "./on-field-tracker"

describe("OnFieldTracker", () => {
  it("inferSwap returns prev=null,next when starting fresh", () => {
    const t = new OnFieldTracker()
    expect(t.inferSwap(1)).toEqual({ prev: null, next: 1 })
  })

  it("inferSwap returns null when next is already on-field", () => {
    const t = new OnFieldTracker()
    t.setCurrent(1)
    expect(t.inferSwap(1)).toBeNull()
  })

  it("inferSwap returns prev/next on cross-character cast", () => {
    const t = new OnFieldTracker()
    t.setCurrent(1)
    expect(t.inferSwap(2)).toEqual({ prev: 1, next: 2 })
  })
})

describe("OnFieldTracker — swap-back clock", () => {
  it("computeSwapBackPad returns remaining cooldown when partially elapsed", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    expect(t.computeSwapBackPad(1, 130)).toBe(30)
  })

  it("computeSwapBackPad returns 0 once 60+ frames have elapsed", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    expect(t.computeSwapBackPad(1, 160)).toBe(0)
    expect(t.computeSwapBackPad(1, 200)).toBe(0)
  })

  it("recordSwapIn clears the off-field record so subsequent computeSwapBackPad returns 0", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.recordSwapIn(1)
    expect(t.computeSwapBackPad(1, 110)).toBe(0)
  })

  it("clear resets the off-field clock map", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.clear()
    expect(t.computeSwapBackPad(1, 110)).toBe(0)
  })

  it("tracks multiple characters independently", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.recordSwapOut(2, 120)
    expect(t.computeSwapBackPad(1, 140)).toBe(20)
    expect(t.computeSwapBackPad(2, 140)).toBe(40)
  })
})

describe("OnFieldTracker — advanceOffFieldClocks", () => {
  it("fully clears CD when advance >= remaining CD", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.advanceOffFieldClocks(60)
    expect(t.computeSwapBackPad(1, 100)).toBe(0)
  })

  it("partially reduces remaining CD", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.advanceOffFieldClocks(20)
    expect(t.computeSwapBackPad(1, 100)).toBe(40)
  })

  it("sequential advances accumulate", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.advanceOffFieldClocks(20)
    t.advanceOffFieldClocks(20)
    expect(t.computeSwapBackPad(1, 100)).toBe(20)
  })
})
