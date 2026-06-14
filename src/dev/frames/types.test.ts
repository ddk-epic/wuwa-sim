import { describe, expect, it } from "vitest"
import { appendStage, removeStageAt, sections, stageIndexOf } from "./types"
import type { Clip, StageRef } from "./types"

const stage = (name: string): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount: 0,
})

function clip(over: Partial<Clip> = {}): Clip {
  return {
    id: "c1",
    name: "",
    start: 0,
    end: 100,
    stageRefs: [],
    boundaries: [],
    hits: [],
    ...over,
  }
}

// A 3-stage clip split at 30 and 70 → sections 0–30, 30–70, 70–100.
const threeStage = clip({
  stageRefs: [stage("A"), stage("B"), stage("C")],
  boundaries: [
    { id: "b0", frame: 30, cue: "animationBreak" },
    { id: "b1", frame: 70, cue: "animationBreak" },
  ],
})

describe("sections", () => {
  it("projects the sequence into contiguous spans bounded by start/dividers/end", () => {
    const secs = sections(threeStage)
    expect(secs.map((s) => [s.ref.stage, s.start, s.end])).toEqual([
      ["A", 0, 30],
      ["B", 30, 70],
      ["C", 70, 100],
    ])
  })
})

describe("appendStage", () => {
  it("adds no divider for the first stage", () => {
    const next = appendStage(clip(), stage("A"), "x")
    expect(next.stageRefs).toHaveLength(1)
    expect(next.boundaries).toHaveLength(0)
  })

  it("inserts a divider at the midpoint of the old last section", () => {
    const one = appendStage(clip(), stage("A"), "x")
    const two = appendStage(one, stage("B"), "b0")
    expect(two.boundaries).toEqual([
      { id: "b0", frame: 50, cue: "animationBreak" },
    ])
    const three = appendStage(two, stage("C"), "b1")
    expect(three.boundaries.map((b) => b.frame)).toEqual([50, 75])
  })
})

describe("removeStageAt", () => {
  it("removing the first stage drops the divider after it", () => {
    const next = removeStageAt(threeStage, 0)
    expect(next.stageRefs.map((s) => s.stage)).toEqual(["B", "C"])
    expect(next.boundaries.map((b) => b.id)).toEqual(["b1"])
  })

  it("removing the last stage drops the divider before it", () => {
    const next = removeStageAt(threeStage, 2)
    expect(next.stageRefs.map((s) => s.stage)).toEqual(["A", "B"])
    expect(next.boundaries.map((b) => b.id)).toEqual(["b0"])
  })

  it("removing the sole stage clears boundaries", () => {
    const one = clip({ stageRefs: [stage("A")] })
    expect(removeStageAt(one, 0).stageRefs).toHaveLength(0)
    expect(removeStageAt(one, 0).boundaries).toHaveLength(0)
  })
})

describe("stageIndexOf", () => {
  it("maps frames inside a section to its index", () => {
    expect(stageIndexOf(threeStage, 15)).toBe(0)
    expect(stageIndexOf(threeStage, 50)).toBe(1)
    expect(stageIndexOf(threeStage, 90)).toBe(2)
  })

  it("a frame on a divider belongs to the later stage it opens", () => {
    expect(stageIndexOf(threeStage, 30)).toBe(1)
    expect(stageIndexOf(threeStage, 70)).toBe(2)
  })

  it("the last stage owns the clip end frame", () => {
    expect(stageIndexOf(threeStage, 100)).toBe(2)
  })
})
