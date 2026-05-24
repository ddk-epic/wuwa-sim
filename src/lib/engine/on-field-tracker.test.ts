import { describe, expect, it } from "vitest"
import { OnFieldTracker } from "./on-field-tracker"

describe("OnFieldTracker", () => {
  it("starts with no on-field character", () => {
    const t = new OnFieldTracker()
    expect(t.current()).toBeNull()
    expect(t.isOnField(1)).toBe(false)
  })

  it("setCurrent records the on-field character", () => {
    const t = new OnFieldTracker()
    t.setCurrent(2)
    expect(t.current()).toBe(2)
    expect(t.isOnField(2)).toBe(true)
    expect(t.isOnField(1)).toBe(false)
  })

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

  it("clear resets state", () => {
    const t = new OnFieldTracker()
    t.setCurrent(3)
    t.clear()
    expect(t.current()).toBeNull()
  })
})

describe("OnFieldTracker — swap-back clock", () => {
  it("computeSwapBack returns 0 when character has no off-field record", () => {
    const t = new OnFieldTracker()
    expect(t.computeSwapBack(1, 100)).toBe(0)
  })

  it("computeSwapBack returns full 60 when character just left the field", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    expect(t.computeSwapBack(1, 100)).toBe(60)
  })

  it("computeSwapBack returns remaining cooldown when partially elapsed", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    expect(t.computeSwapBack(1, 130)).toBe(30)
  })

  it("computeSwapBack returns 0 once 60+ frames have elapsed", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    expect(t.computeSwapBack(1, 160)).toBe(0)
    expect(t.computeSwapBack(1, 200)).toBe(0)
  })

  it("recordSwapIn clears the off-field record so subsequent computeSwapBack returns 0", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.recordSwapIn(1)
    expect(t.computeSwapBack(1, 110)).toBe(0)
  })

  it("clear resets the off-field clock map", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.clear()
    expect(t.computeSwapBack(1, 110)).toBe(0)
  })

  it("tracks multiple characters independently", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.recordSwapOut(2, 120)
    expect(t.computeSwapBack(1, 140)).toBe(20)
    expect(t.computeSwapBack(2, 140)).toBe(40)
  })
})

describe("OnFieldTracker — advanceOffFieldClocks", () => {
  it("fully clears CD when advance >= remaining CD", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.advanceOffFieldClocks(60)
    expect(t.computeSwapBack(1, 100)).toBe(0)
  })

  it("partially reduces remaining CD", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.advanceOffFieldClocks(20)
    expect(t.computeSwapBack(1, 100)).toBe(40)
  })

  it("advances all off-field characters uniformly", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.recordSwapOut(2, 100)
    t.advanceOffFieldClocks(30)
    expect(t.computeSwapBack(1, 100)).toBe(30)
    expect(t.computeSwapBack(2, 100)).toBe(30)
  })

  it("sequential advances accumulate", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.advanceOffFieldClocks(20)
    t.advanceOffFieldClocks(20)
    expect(t.computeSwapBack(1, 100)).toBe(20)
  })

  it("does not affect characters with no off-field record", () => {
    const t = new OnFieldTracker()
    t.advanceOffFieldClocks(60)
    expect(t.computeSwapBack(1, 100)).toBe(0)
  })

  it("advance does not affect character that subsequently recordSwapIn", () => {
    const t = new OnFieldTracker()
    t.recordSwapOut(1, 100)
    t.advanceOffFieldClocks(60)
    t.recordSwapIn(1)
    expect(t.computeSwapBack(1, 100)).toBe(0)
  })
})
