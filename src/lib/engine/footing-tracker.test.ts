import { describe, expect, it } from "vitest"
import { FootingTracker } from "./footing-tracker"

describe("FootingTracker", () => {
  it("starts with ground team footing and no carried overrides", () => {
    const t = new FootingTracker()
    expect(t.teamFooting()).toBe("ground")
    expect(t.carriedFor(1)).toBeUndefined()
  })

  it("clear resets team to ground, drops carried, and increments version", () => {
    const t = new FootingTracker()
    t.setTeam("air")
    t.setCarried(1, "air")
    const v = t.mutationVersion()
    t.clear()
    expect(t.teamFooting()).toBe("ground")
    expect(t.carriedFor(1)).toBeUndefined()
    expect(t.mutationVersion()).toBeGreaterThan(v)
  })

  it("setTeam updates team footing and increments version", () => {
    const t = new FootingTracker()
    const v0 = t.mutationVersion()
    t.setTeam("air")
    expect(t.teamFooting()).toBe("air")
    expect(t.mutationVersion()).toBeGreaterThan(v0)
  })

  it("setTeam to same value does not increment version", () => {
    const t = new FootingTracker()
    const v = t.mutationVersion()
    t.setTeam("ground")
    expect(t.mutationVersion()).toBe(v)
  })

  it("carried footing is per-character and independent of team footing", () => {
    const t = new FootingTracker()
    t.setCarried(1, "air")
    expect(t.carriedFor(1)).toBe("air")
    expect(t.carriedFor(2)).toBeUndefined()
    expect(t.teamFooting()).toBe("ground")
  })

  it("takeCarried removes the override", () => {
    const t = new FootingTracker()
    t.setCarried(1, "air")
    t.takeCarried(1)
    expect(t.carriedFor(1)).toBeUndefined()
  })
})
