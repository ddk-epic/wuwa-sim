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
