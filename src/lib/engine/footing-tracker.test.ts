import { describe, expect, it } from "vitest"
import { FootingTracker } from "./footing-tracker"

describe("FootingTracker", () => {
  it("starts at ground", () => {
    const t = new FootingTracker()
    expect(t.current()).toBe("ground")
  })

  it("clear resets to ground and increments version", () => {
    const t = new FootingTracker()
    t.setCurrent("air")
    const v = t.mutationVersion()
    t.clear()
    expect(t.current()).toBe("ground")
    expect(t.mutationVersion()).toBeGreaterThan(v)
  })

  it("setCurrent updates value and increments version", () => {
    const t = new FootingTracker()
    const v0 = t.mutationVersion()
    t.setCurrent("air")
    expect(t.current()).toBe("air")
    expect(t.mutationVersion()).toBeGreaterThan(v0)
  })

  it("setCurrent to same value does not increment version", () => {
    const t = new FootingTracker()
    const v = t.mutationVersion()
    t.setCurrent("ground")
    expect(t.mutationVersion()).toBe(v)
  })

  it("round-trip ground → air → ground", () => {
    const t = new FootingTracker()
    t.setCurrent("air")
    t.setCurrent("ground")
    expect(t.current()).toBe("ground")
  })
})
