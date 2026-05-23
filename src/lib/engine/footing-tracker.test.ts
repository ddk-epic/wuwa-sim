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

describe("FootingTracker — snapshot (ADR-0022 slice 3)", () => {
  it("consumeSnapshot returns null when no snapshot exists", () => {
    const t = new FootingTracker()
    expect(t.consumeSnapshot(1)).toBeNull()
  })

  it("snapshotOnSwapOut then consumeSnapshot returns stored footing and clears it", () => {
    const t = new FootingTracker()
    t.snapshotOnSwapOut(1, "air")
    expect(t.consumeSnapshot(1)).toBe("air")
    expect(t.consumeSnapshot(1)).toBeNull()
  })

  it("clearSnapshot removes the snapshot without returning it", () => {
    const t = new FootingTracker()
    t.snapshotOnSwapOut(1, "air")
    t.clearSnapshot(1)
    expect(t.consumeSnapshot(1)).toBeNull()
  })

  it("snapshots are per-character and do not interfere", () => {
    const t = new FootingTracker()
    t.snapshotOnSwapOut(1, "air")
    t.snapshotOnSwapOut(2, "ground")
    expect(t.consumeSnapshot(1)).toBe("air")
    expect(t.consumeSnapshot(2)).toBe("ground")
  })

  it("clear() also clears all snapshots", () => {
    const t = new FootingTracker()
    t.snapshotOnSwapOut(1, "air")
    t.clear()
    expect(t.consumeSnapshot(1)).toBeNull()
  })
})
