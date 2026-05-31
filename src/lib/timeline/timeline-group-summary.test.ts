import { describe, expect, it } from "vitest"
import { summarizeGroups } from "./timeline-group-summary"
import type { TimelineSummaryRow } from "./timeline-summary"

function row(p: Partial<TimelineSummaryRow>): TimelineSummaryRow {
  return {
    timeFrames: 0,
    durationFrames: 0,
    reactFrames: 0,
    floorFrames: 0,
    padFrames: 0,
    fallFrames: 0,
    swapBackFrames: 0,
    damage: null,
    cumulativeConcerto: null,
    cumulativeEnergy: null,
    ...p,
  }
}

describe("summarizeGroups", () => {
  it("rolls a group's span into totals, start time, and end resources", () => {
    const rows = [
      row({ timeFrames: 0 }), // index 0 — outside the group
      row({
        timeFrames: 30,
        durationFrames: 20,
        damage: 100,
        cumulativeConcerto: 10,
        cumulativeEnergy: 5,
      }),
      row({
        timeFrames: 50,
        durationFrames: 25,
        damage: 200,
        cumulativeConcerto: 18,
        cumulativeEnergy: 9,
      }),
    ]
    const result = summarizeGroups(rows, [
      { groupId: "g1", startFlatIndex: 1, entryCount: 2 },
    ])
    expect(result.get("g1")).toEqual({
      totalDamage: 300,
      totalDurationFrames: 45,
      startTimeFrames: 30, // first row of the span, not row 0
      endConcerto: 18, // last row of the span
      endEnergy: 9,
    })
  })

  it("reports totalDamage null when no row carried damage (no sim run)", () => {
    const rows = [row({ durationFrames: 20 }), row({ durationFrames: 25 })]
    const gs = summarizeGroups(rows, [
      { groupId: "g", startFlatIndex: 0, entryCount: 2 },
    ]).get("g")
    expect(gs?.totalDamage).toBeNull()
    expect(gs?.totalDurationFrames).toBe(45)
  })

  it("distinguishes a real damage sum of 0 from no damage", () => {
    const rows = [row({ damage: 0 }), row({ damage: 0 })]
    const gs = summarizeGroups(rows, [
      { groupId: "g", startFlatIndex: 0, entryCount: 2 },
    ]).get("g")
    expect(gs?.totalDamage).toBe(0)
  })

  it("sums only non-null damage rows but still reports a number", () => {
    const rows = [
      row({ damage: 100 }),
      row({ damage: null }),
      row({ damage: 50 }),
    ]
    const gs = summarizeGroups(rows, [
      { groupId: "g", startFlatIndex: 0, entryCount: 3 },
    ]).get("g")
    expect(gs?.totalDamage).toBe(150)
  })

  it("handles an empty group: zeros and null end resources", () => {
    const gs = summarizeGroups(
      [row({ timeFrames: 99 })],
      [{ groupId: "empty", startFlatIndex: 0, entryCount: 0 }],
    ).get("empty")
    expect(gs).toEqual({
      totalDamage: null,
      totalDurationFrames: 0,
      startTimeFrames: 0,
      endConcerto: null,
      endEnergy: null,
    })
  })

  it("handles a single-entry group", () => {
    const rows = [
      row({
        timeFrames: 12,
        durationFrames: 8,
        damage: 42,
        cumulativeConcerto: 3,
        cumulativeEnergy: 1,
      }),
    ]
    const gs = summarizeGroups(rows, [
      { groupId: "solo", startFlatIndex: 0, entryCount: 1 },
    ]).get("solo")
    expect(gs).toEqual({
      totalDamage: 42,
      totalDurationFrames: 8,
      startTimeFrames: 12,
      endConcerto: 3,
      endEnergy: 1,
    })
  })

  it("keys multiple groups independently", () => {
    const rows = [
      row({ damage: 1, durationFrames: 5 }),
      row({ damage: 2, durationFrames: 6 }),
      row({ damage: 4, durationFrames: 7 }),
    ]
    const result = summarizeGroups(rows, [
      { groupId: "a", startFlatIndex: 0, entryCount: 1 },
      { groupId: "b", startFlatIndex: 1, entryCount: 2 },
    ])
    expect(result.get("a")?.totalDamage).toBe(1)
    expect(result.get("b")?.totalDamage).toBe(6)
    expect(result.size).toBe(2)
  })
})
