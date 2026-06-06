import { describe, expect, it } from "vitest"
import { AERO_EROSION } from "#/data/neg-statuses"
import { DEFAULT_TARGET_PARAMS } from "#/types/target"
import { Target } from "./target"

const FPS = 60

describe("Target params", () => {
  it("defaults reproduce the historical mitigation constants", () => {
    const t = new Target()
    expect(t.getParams()).toEqual(DEFAULT_TARGET_PARAMS)
  })

  it("reset overrides only the provided params", () => {
    const t = new Target()
    t.reset({ level: 90 })
    expect(t.getParams().level).toBe(90)
    expect(t.getParams().defMultConst).toBe(DEFAULT_TARGET_PARAMS.defMultConst)
  })
})

describe("Negative Status apply/presence", () => {
  it("apply adds stacks clamped to cap", () => {
    const t = new Target()
    t.apply(AERO_EROSION, 2, 0, 1)
    expect(t.stacksOf("Aero Erosion")).toBe(2)
    t.apply(AERO_EROSION, 5, 0, 1)
    expect(t.stacksOf("Aero Erosion")).toBe(AERO_EROSION.cap)
  })

  it("re-apply at max resets duration without adding stacks", () => {
    const t = new Target()
    t.apply(AERO_EROSION, AERO_EROSION.cap, 0, 1)
    expect(t.list()[0].endTime).toBe(AERO_EROSION.duration * FPS)
    t.apply(AERO_EROSION, 3, 300, 1)
    expect(t.stacksOf("Aero Erosion")).toBe(AERO_EROSION.cap)
    expect(t.list()[0].endTime).toBe(300 + AERO_EROSION.duration * FPS)
  })

  it("reduceBy lowers stacks and removes the status at 0", () => {
    const t = new Target()
    t.apply(AERO_EROSION, 3, 0, 1)
    t.reduceBy("Aero Erosion", 1)
    expect(t.stacksOf("Aero Erosion")).toBe(2)
    t.reduceBy("Aero Erosion", 5)
    expect(t.has("Aero Erosion")).toBe(false)
    expect(t.hasAnyStatus()).toBe(false)
  })

  it("raiseToMax sets stacks to the current cap", () => {
    const t = new Target()
    t.apply(AERO_EROSION, 1, 0, 1)
    t.raiseToMax(AERO_EROSION, 0, 1)
    expect(t.stacksOf("Aero Erosion")).toBe(AERO_EROSION.cap)
  })

  it("raiseCap lifts the ceiling so later applies exceed the base cap", () => {
    const t = new Target()
    t.apply(AERO_EROSION, 3, 0, 1)
    t.raiseCap("Aero Erosion", 3)
    t.apply(AERO_EROSION, 3, 0, 1)
    expect(t.stacksOf("Aero Erosion")).toBe(6)
  })

  it("presence is independent of stacks", () => {
    const t = new Target()
    expect(t.hasAnyStatus()).toBe(false)
    t.apply(AERO_EROSION, 1, 0, 1)
    expect(t.hasAnyStatus()).toBe(true)
  })

  it("expireBefore removes a status past its endTime", () => {
    const t = new Target()
    t.apply(AERO_EROSION, 1, 0, 1)
    t.expireBefore(AERO_EROSION.duration * FPS - 1)
    expect(t.hasAnyStatus()).toBe(true)
    t.expireBefore(AERO_EROSION.duration * FPS)
    expect(t.hasAnyStatus()).toBe(false)
  })

  it("mutationVersion advances on every mutation", () => {
    const t = new Target()
    const v0 = t.mutationVersion()
    t.apply(AERO_EROSION, 1, 0, 1)
    expect(t.mutationVersion()).toBeGreaterThan(v0)
  })
})
