import { describe, expect, it } from "vitest"
import {
  DEFAULT_CALIBRATION,
  clampPoint,
  fillFractionAt,
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

describe("fillFractionAt", () => {
  const cal = { empty: { x: 0.2, y: 0.5 }, full: { x: 0.8, y: 0.5 } }

  it("reads the fraction along the axis at the projected point", () => {
    expect(fillFractionAt(cal, { x: 0.5, y: 0.5 })).toBeCloseTo(0.5)
    expect(fillFractionAt(cal, { x: 0.2, y: 0.5 })).toBeCloseTo(0)
    expect(fillFractionAt(cal, { x: 0.8, y: 0.5 })).toBeCloseTo(1)
  })

  it("projects an off-axis point onto the line", () => {
    expect(fillFractionAt(cal, { x: 0.5, y: 0.9 })).toBeCloseTo(0.5)
  })

  it("clamps past either end", () => {
    expect(fillFractionAt(cal, { x: 0, y: 0.5 })).toBe(0)
    expect(fillFractionAt(cal, { x: 1, y: 0.5 })).toBe(1)
  })

  it("reflows when the bar is recalibrated", () => {
    const p = { x: 0.5, y: 0.5 }
    const widened = { empty: { x: 0, y: 0.5 }, full: { x: 1, y: 0.5 } }
    expect(fillFractionAt(cal, p)).toBeCloseTo(0.5)
    expect(fillFractionAt(widened, p)).toBeCloseTo(0.5)
    const shifted = { empty: { x: 0.5, y: 0.5 }, full: { x: 1, y: 0.5 } }
    expect(fillFractionAt(shifted, p)).toBeCloseTo(0)
  })
})
