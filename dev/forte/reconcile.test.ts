import { describe, expect, it } from "vitest"
import { reconcileForte } from "./reconcile"
import type { ForteClip, ForteSeparator } from "./clip"
import type { StageRef } from "../frames/stage-ref"

// A horizontal bar spanning the whole width: a fill point's x is its fraction.
const CAL = { empty: { x: 0, y: 0.5 }, full: { x: 1, y: 0.5 } }

const stage = (name: string): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount: 0,
})

const sep = (
  id: string,
  owner: number,
  fraction: number,
  frame = 0,
): ForteSeparator => ({ id, owner, frame, fill: { x: fraction, y: 0.5 } })

function clip(over: Partial<ForteClip> = {}): ForteClip {
  return {
    id: "c1",
    name: "",
    start: 0,
    end: 60,
    stageRefs: [stage("b1"), stage("b1"), stage("b1"), stage("b1")],
    calibration: CAL,
    ...over,
  }
}

describe("reconcileForte", () => {
  it("is unmeasured with no separators", () => {
    expect(reconcileForte(clip({ separators: [] }), 100)).toEqual({
      status: "unmeasured",
    })
  })

  it("a b1x4 clip yields four readings of forte(b1) off consecutive diffs", () => {
    const c = clip({
      separators: [
        sep("s0", 0, 0.25),
        sep("s1", 1, 0.5),
        sep("s2", 2, 0.75),
        sep("s3", 3, 1.0),
      ],
    })
    const r = reconcileForte(c, 100)
    expect(r.status).toBe("measured")
    if (r.status !== "measured") return
    expect(r.observations.map((o) => o.gain)).toEqual([25, 25, 25, 25])
    expect(r.mean).toBeCloseTo(25)
    expect(r.spread).toBeCloseTo(0)
  })

  it("orders by owner regardless of stored order, and reports spread", () => {
    const c = clip({
      separators: [
        sep("s2", 2, 0.7),
        sep("s0", 0, 0.2),
        sep("s1", 1, 0.5),
        sep("s3", 3, 1.0),
      ],
    })
    const r = reconcileForte(c, 100)
    if (r.status !== "measured") throw new Error("expected measured")
    // Diffs off ordered levels [0, .2, .5, .7, 1] x100.
    const gains = r.observations.map((o) => o.gain)
    ;[20, 30, 20, 30].forEach((g, i) => expect(gains[i]).toBeCloseTo(g))
    expect(r.spread).toBeGreaterThan(0)
  })

  it("counts from an explicit non-zero baseline", () => {
    const c = clip({
      baseline: 0.1,
      separators: [sep("s0", 0, 0.3)],
    })
    const r = reconcileForte(c, 100)
    if (r.status !== "measured") throw new Error("expected measured")
    expect(r.observations[0].gain).toBeCloseTo(20)
  })

  it("scales by forteCap", () => {
    const c = clip({ separators: [sep("s0", 0, 0.5)] })
    const r = reconcileForte(c, 120)
    if (r.status !== "measured") throw new Error("expected measured")
    expect(r.observations[0].gain).toBeCloseTo(60)
  })

  it("reflows when the bar is recalibrated", () => {
    const seps = [sep("s0", 0, 0.5)]
    const wide = reconcileForte(clip({ separators: seps }), 100)
    // Halve the axis: the same fill point now reads full.
    const narrow = reconcileForte(
      clip({
        separators: seps,
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
