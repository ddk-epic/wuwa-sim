import { describe, expect, it } from "vitest"
import {
  DEFAULT_CALIBRATION,
  clampPoint,
  translateCalibration,
} from "./calibration"

describe("clampPoint", () => {
  it("keeps an in-frame point untouched", () => {
    expect(clampPoint({ x: 0.4, y: 0.6 })).toEqual({ x: 0.4, y: 0.6 })
  })

  it("clamps both axes into [0,1]", () => {
    expect(clampPoint({ x: -0.5, y: 1.5 })).toEqual({ x: 0, y: 1 })
  })
})

describe("translateCalibration", () => {
  it("shifts both endpoints by the delta", () => {
    const cal = { empty: { x: 0.3, y: 0.5 }, full: { x: 0.5, y: 0.5 } }
    expect(translateCalibration(cal, 0.1, -0.2)).toEqual({
      empty: { x: 0.4, y: 0.3 },
      full: { x: 0.6, y: 0.3 },
    })
  })

  it("backs off so neither endpoint leaves the frame, preserving length", () => {
    const cal = { empty: { x: 0.6, y: 0.5 }, full: { x: 0.9, y: 0.5 } }
    const moved = translateCalibration(cal, 0.5, 0)
    expect(moved.full.x).toBe(1)
    expect(moved.full.x - moved.empty.x).toBeCloseTo(0.3)
  })

  it("defaults to a visible horizontal bar", () => {
    expect(DEFAULT_CALIBRATION.empty.y).toBe(DEFAULT_CALIBRATION.full.y)
    expect(DEFAULT_CALIBRATION.empty.x).toBeLessThan(DEFAULT_CALIBRATION.full.x)
  })
})
