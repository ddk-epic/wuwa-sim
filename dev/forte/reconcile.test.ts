// @vitest-environment node
import { describe, expect, it } from "vitest"
import { reconcileForte } from "./reconcile"
import type { ForteClip, ForteSlot } from "./clip"
import type { StageRef } from "../frames/stage-ref"

// A horizontal bar spanning the whole width: a fill point's x is its fraction.
const CAL = { empty: { x: 0, y: 0.5 }, full: { x: 1, y: 0.5 } }

const stage = (name: string): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount: 0,
})

let n = 0
const slot = (fraction?: number): ForteSlot => ({
  id: `slot-${n++}`,
  ref: stage("b1"),
  reading: fraction == null ? undefined : { x: fraction, y: 0.5 },
})

function clip(slots: ForteSlot[], over: Partial<ForteClip> = {}): ForteClip {
  return { id: "c1", name: "", slots, calibration: CAL, ...over }
}

describe("reconcileForte", () => {
  it("is unmeasured when no slot carries a reading", () => {
    expect(reconcileForte(clip([slot(), slot()]), 100)).toEqual({
      status: "unmeasured",
    })
  })

  it("a b1x4 clip yields four readings off consecutive diffs", () => {
    const r = reconcileForte(
      clip([slot(0.25), slot(0.5), slot(0.75), slot(1)]),
      100,
    )
    if (r.status !== "measured") throw new Error("expected measured")
    expect(r.observations.map((o) => o.gain)).toEqual([25, 25, 25, 25])
    expect(r.mean).toBeCloseTo(25)
    expect(r.spread).toBeCloseTo(0)
  })

  it("skips unmeasured slots, diffing across the gap and reporting spread", () => {
    const r = reconcileForte(clip([slot(0.2), slot(), slot(0.6)]), 100)
    if (r.status !== "measured") throw new Error("expected measured")
    expect(r.observations).toEqual([
      { owner: 0, gain: 20 },
      { owner: 2, gain: 40 },
    ])
    expect(r.spread).toBeGreaterThan(0)
  })

  it("scales by forteCap", () => {
    const r = reconcileForte(clip([slot(0.5)]), 120)
    if (r.status !== "measured") throw new Error("expected measured")
    expect(r.observations[0].gain).toBeCloseTo(60)
  })

  it("reflows when the bar is recalibrated", () => {
    const wide = reconcileForte(clip([slot(0.5)]), 100)
    // Halve the axis: the same fill point now reads full.
    const narrow = reconcileForte(
      clip([slot(0.5)], {
        calibration: { empty: { x: 0, y: 0.5 }, full: { x: 0.5, y: 0.5 } },
      }),
      100,
    )
    if (wide.status !== "measured" || narrow.status !== "measured")
      throw new Error("expected measured")
    expect(wide.observations[0].gain).toBeCloseTo(50)
    expect(narrow.observations[0].gain).toBeCloseTo(100)
  })
})
