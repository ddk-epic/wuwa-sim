// @vitest-environment node
import { describe, expect, it } from "vitest"
import { forteSummaryRows, summaryToText } from "./summary"
import type { ForteClip, ForteSlot } from "./clip"
import type { StageRef } from "../frames/stage-ref"

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

describe("forteSummaryRows", () => {
  it("derives percent as the average share of forteCap, readings flowing through", () => {
    const [row] = forteSummaryRows([clip([slot(0.3), slot(0.6)])], 120)
    expect(row.measured).toBe(true)
    expect(row.readings).toHaveLength(2)
    expect(row.average).toBeCloseTo(36)
    expect(row.percent).toBeCloseTo(30)
  })

  it("flags an unmeasured clip", () => {
    const [row] = forteSummaryRows([clip([slot(), slot()])], 100)
    expect(row.measured).toBe(false)
    expect(row.readings).toEqual([])
  })
})

describe("summaryToText", () => {
  it("is tab-separated with a per-repeat column per widest clip", () => {
    const rows = forteSummaryRows(
      [
        clip([slot(0.06), slot(0.12)], { id: "a", name: "b1" }),
        clip([slot(0.2)], { id: "b", name: "skill" }),
      ],
      100,
    )
    const text = summaryToText(rows, 100)
    const [header, first, second] = text.split("\n")
    expect(header.split("\t")).toEqual([
      "Action",
      "1",
      "2",
      "avg %",
      "forte",
      "± err",
    ])
    expect(first.split("\t")[0]).toBe("b1")
    // Single-reading clip pads its missing repeat column.
    expect(second.split("\t")).toHaveLength(6)
    expect(second.split("\t")[2]).toBe("")
  })
})
