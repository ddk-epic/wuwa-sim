// @vitest-environment node
import { describe, expect, it } from "vitest"
import { FootingTracker } from "./footing-tracker"

describe("FootingTracker", () => {
  it("clear resets team to ground, drops carried, and increments version", () => {
    const t = new FootingTracker()
    t.setTeam("air")
    t.setCarriedFooting(1, "air")
    const v = t.mutationVersion()
    t.clear()
    expect(t.team()).toBe("ground")
    expect(t.carriedFooting(1)).toBeUndefined()
    expect(t.mutationVersion()).toBeGreaterThan(v)
  })

  it("carried footing is per-character and independent of team footing", () => {
    const t = new FootingTracker()
    t.setCarriedFooting(1, "air")
    expect(t.carriedFooting(1)).toBe("air")
    expect(t.carriedFooting(2)).toBeUndefined()
    expect(t.team()).toBe("ground")
  })
})
