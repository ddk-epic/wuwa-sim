// @vitest-environment node
import { describe, expect, it } from "vitest"
import { forteSummaryRows, summaryToText } from "./summary"
import type { ForteClip, ForteSeparator } from "./clip"
import type { StageRef } from "../frames/stage-ref"

const CAL = { empty: { x: 0, y: 0.5 }, full: { x: 1, y: 0.5 } }

const stage = (name: string): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount: 0,
})

const sep = (id: string, owner: number, fraction: number): ForteSeparator => ({
  id,
  owner,
  frame: 0,
  fill: { x: fraction, y: 0.5 },
})

function clip(over: Partial<ForteClip> = {}): ForteClip {
  return {
    id: "c1",
    name: "",
    start: 0,
    end: 60,
    stageRefs: [stage("b1"), stage("b1")],
    calibration: CAL,
    ...over,
  }
}

describe("forteSummaryRows", () => {
  it("derives percent as the average share of forteCap, readings flowing through", () => {
    const c = clip({ separators: [sep("s0", 0, 0.3), sep("s1", 1, 0.6)] })
    const [row] = forteSummaryRows([c], 120)
    expect(row.measured).toBe(true)
    expect(row.readings).toHaveLength(2)
    expect(row.average).toBeCloseTo(36)
    expect(row.percent).toBeCloseTo(30)
  })

  it("flags an unmeasured clip", () => {
    const [row] = forteSummaryRows([clip({ separators: [] })], 100)
    expect(row.measured).toBe(false)
    expect(row.readings).toEqual([])
  })
})

describe("summaryToText", () => {
  it("is tab-separated with a per-repeat column per widest clip", () => {
    const rows = forteSummaryRows(
      [
        clip({
          id: "a",
          name: "b1",
          separators: [sep("s0", 0, 0.06), sep("s1", 1, 0.12)],
        }),
        clip({ id: "b", name: "skill", separators: [sep("s2", 0, 0.2)] }),
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
