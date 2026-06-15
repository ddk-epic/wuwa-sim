import { describe, expect, it } from "vitest"
import {
  appendStage,
  applyClipEdit,
  exceedingHitIds,
  hitsByStage,
  hitsInStage,
  removeStageAt,
  sections,
  stageCapacity,
  stageIndexOf,
} from "./types"
import type { Clip, StageRef } from "./types"

const stage = (name: string, hitCount = 0): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount,
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

describe("hitsInStage", () => {
  it("counts hits by the stage their frame falls in", () => {
    const c = clip({
      ...threeStage,
      hits: [
        { id: "h0", frame: 10, cue: "impactFlash" },
        { id: "h1", frame: 20, cue: "impactFlash" },
        { id: "h2", frame: 50, cue: "impactFlash" },
      ],
    })
    expect(hitsInStage(c, 0)).toBe(2)
    expect(hitsInStage(c, 1)).toBe(1)
    expect(hitsInStage(c, 2)).toBe(0)
  })
})

describe("exceedingHitIds", () => {
  it("flags the surplus hits past each stage's capacity, keeping the earliest", () => {
    const c = clip({
      stageRefs: [stage("A", 1), stage("B", 2), stage("C", 0)],
      boundaries: [
        { id: "b0", frame: 30, cue: "animationBreak" },
        { id: "b1", frame: 70, cue: "animationBreak" },
      ],
      hits: [
        { id: "a0", frame: 5, cue: "impactFlash" },
        { id: "a1", frame: 25, cue: "impactFlash" },
        { id: "b0", frame: 40, cue: "impactFlash" },
        { id: "c0", frame: 80, cue: "impactFlash" },
      ],
    })
    // A keeps the earliest (a0) and flags a1; B is within its cap of 2; C allows none.
    expect([...exceedingHitIds(c)].sort()).toEqual(["a1", "c0"])
  })
})

describe("stageCapacity", () => {
  it("reads the stage reference's hit count, or 0 when out of range", () => {
    const c = clip({ stageRefs: [stage("A", 3), stage("B", 0)] })
    expect(stageCapacity(c, 0)).toBe(3)
    expect(stageCapacity(c, 1)).toBe(0)
    expect(stageCapacity(c, 5)).toBe(0)
  })
})

describe("hitsByStage", () => {
  it("groups hits into their stage, each group ordered by frame", () => {
    const c = clip({
      ...threeStage,
      hits: [
        { id: "late", frame: 25, cue: "impactFlash" },
        { id: "early", frame: 5, cue: "impactFlash" },
        { id: "mid", frame: 50, cue: "impactFlash" },
      ],
    })
    expect(hitsByStage(c).map((g) => g.map((h) => h.id))).toEqual([
      ["early", "late"],
      ["mid"],
      [],
    ])
  })
})

describe("applyClipEdit", () => {
  const capped = clip({
    stageRefs: [stage("A", 1), stage("B", 0), stage("C", 2)],
    boundaries: [
      { id: "b0", frame: 30, cue: "animationBreak" },
      { id: "b1", frame: 70, cue: "animationBreak" },
    ],
  })

  it("clamps a moved boundary between its neighbours", () => {
    const hi = applyClipEdit(threeStage, {
      type: "moveBoundary",
      index: 0,
      frame: 999,
    })
    expect(hi.boundaries[0].frame).toBe(69)
    const lo = applyClipEdit(threeStage, {
      type: "moveBoundary",
      index: 0,
      frame: -999,
    })
    expect(lo.boundaries[0].frame).toBe(1)
  })

  it("leaves a boundary unchanged when its neighbours leave no room", () => {
    const tight = clip({
      start: 0,
      end: 1,
      stageRefs: [stage("A"), stage("B")],
      boundaries: [{ id: "b0", frame: 1, cue: "animationBreak" }],
    })
    expect(
      applyClipEdit(tight, { type: "moveBoundary", index: 0, frame: 0 }),
    ).toBe(tight)
  })

  it("appends a hit within capacity and clamps it into the clip", () => {
    const next = applyClipEdit(capped, {
      type: "addHit",
      hit: { id: "h", frame: 999, cue: "impactFlash" },
    })
    expect(next.hits).toEqual([{ id: "h", frame: 100, cue: "impactFlash" }])
  })

  it("rejects a hit that would exceed the stage's capacity", () => {
    const filled = applyClipEdit(capped, {
      type: "addHit",
      hit: { id: "h0", frame: 10, cue: "impactFlash" },
    })
    const rejected = applyClipEdit(filled, {
      type: "addHit",
      hit: { id: "h1", frame: 20, cue: "impactFlash" },
    })
    expect(rejected).toBe(filled)
  })

  it("refuses to move a hit into a stage already at capacity", () => {
    const withHit = applyClipEdit(capped, {
      type: "addHit",
      hit: { id: "h", frame: 10, cue: "impactFlash" },
    })
    const blocked = applyClipEdit(withHit, {
      type: "moveHit",
      id: "h",
      frame: 50,
    })
    expect(blocked).toBe(withHit)
    const ok = applyClipEdit(withHit, { type: "moveHit", id: "h", frame: 20 })
    expect(ok.hits[0].frame).toBe(20)
  })
})
