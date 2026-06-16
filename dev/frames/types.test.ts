import { describe, expect, it } from "vitest"
import {
  appendStage,
  applyClipEdit,
  exceedingHitIds,
  hitsByStage,
  hitsInStage,
  ownerIndexOf,
  removeStageAt,
  resolveVariantTarget,
  sections,
  stageIndexOf,
} from "./types"
import type { Clip, HitMark, StageRef } from "./types"

const stage = (name: string, hitCount = 0): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount,
})

const hit = (
  id: string,
  frame: number,
  owner: number,
  cue: HitMark["cue"] = "impactFlash",
): HitMark => ({ id, frame, cue, owner })

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

  it("bounds the last stage at restStart, leaving the tail as rest", () => {
    const withRest = clip({
      stageRefs: [stage("A"), stage("B")],
      boundaries: [{ id: "b0", frame: 30, cue: "animationBreak" }],
      restStart: 70,
    })
    expect(
      sections(withRest).map((s) => [s.ref.stage, s.start, s.end]),
    ).toEqual([
      ["A", 0, 30],
      ["B", 30, 70],
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

  it("returns -1 for a frame in the rest zone", () => {
    const withRest = clip({
      stageRefs: [stage("A"), stage("B")],
      boundaries: [{ id: "b0", frame: 30, cue: "animationBreak" }],
      restStart: 70,
    })
    expect(stageIndexOf(withRest, 70)).toBe(1)
    expect(stageIndexOf(withRest, 85)).toBe(-1)
  })
})

describe("ownerIndexOf", () => {
  it("reads the stored owner, independent of where the frame sits", () => {
    expect(ownerIndexOf(threeStage, hit("h", 90, 0))).toBe(0)
  })

  it("clamps a stale owner into the clip's stages, and is -1 with no stages", () => {
    expect(ownerIndexOf(threeStage, hit("h", 10, 9))).toBe(2)
    expect(ownerIndexOf(clip(), hit("h", 10, 0))).toBe(-1)
  })
})

describe("hitsInStage / hitsByStage", () => {
  it("count and group by owner, not by frame position", () => {
    const c = clip({
      ...threeStage,
      hits: [
        hit("own", 10, 0),
        // Frame sits in stage 1 but it is owned by (trailing from) stage 0.
        hit("trailing", 50, 0),
        hit("mid", 55, 1),
      ],
    })
    expect(hitsInStage(c, 0)).toBe(2)
    expect(hitsInStage(c, 1)).toBe(1)
    expect(hitsByStage(c).map((g) => g.map((h) => h.id))).toEqual([
      ["own", "trailing"],
      ["mid"],
      [],
    ])
  })
})

describe("exceedingHitIds", () => {
  it("flags the surplus hits past each owner's capacity, keeping the earliest", () => {
    const c = clip({
      stageRefs: [stage("A", 1), stage("B", 2), stage("C", 0)],
      boundaries: [
        { id: "b0", frame: 30, cue: "animationBreak" },
        { id: "b1", frame: 70, cue: "animationBreak" },
      ],
      hits: [
        hit("a0", 5, 0),
        hit("a1", 25, 0),
        hit("b0", 40, 1),
        hit("c0", 80, 2),
      ],
    })
    expect([...exceedingHitIds(c)].sort()).toEqual(["a1", "c0"])
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

  it("normalizes length to 0-based on lock, capturing the in-cut as the offset", () => {
    const scoped = clip({ start: 1830, end: 1920 })
    const locked = applyClipEdit(scoped, { type: "lockScope" })
    expect([locked.start, locked.end, locked.offset]).toEqual([0, 90, 1830])
  })

  it("re-scope lifts the window back to absolute frames; lock restores it — marks never move", () => {
    const locked = clip({
      start: 0,
      end: 90,
      offset: 1830,
      boundaries: [{ id: "b0", frame: 30, cue: "impactFlash" }],
      hits: [hit("h", 15, 0)],
    })
    const reopened = applyClipEdit(locked, { type: "enterScope" })
    expect([reopened.start, reopened.end, reopened.offset]).toEqual([
      1830,
      1920,
      undefined,
    ])
    // Marks stay in 0-based clip space throughout — only the window moves.
    expect(reopened.boundaries[0].frame).toBe(30)
    expect(reopened.hits[0].frame).toBe(15)

    const relocked = applyClipEdit(reopened, { type: "lockScope" })
    expect([relocked.start, relocked.end, relocked.offset]).toEqual([
      0, 90, 1830,
    ])
    expect(relocked.hits[0].frame).toBe(15)
  })

  it("clamps a moved boundary between its neighbours", () => {
    const hi = applyClipEdit(threeStage, {
      type: "moveBoundary",
      index: 0,
      frame: 999,
    })
    expect(hi.boundaries[0].frame).toBe(69)
  })

  it("drags restStart to resize the last stage, clamped past the last boundary", () => {
    const single = clip({ stageRefs: [stage("A")], restStart: 70 })
    expect(
      applyClipEdit(single, { type: "moveRestStart", frame: 40 }).restStart,
    ).toBe(40)
    expect(
      applyClipEdit(single, { type: "moveRestStart", frame: 999 }).restStart,
    ).toBe(99)

    const withBoundary = clip({
      stageRefs: [stage("A"), stage("B")],
      boundaries: [{ id: "b0", frame: 30, cue: "animationBreak" }],
      restStart: 70,
    })
    expect(
      applyClipEdit(withBoundary, { type: "moveRestStart", frame: 10 })
        .restStart,
    ).toBe(31)
  })

  it("removing the rest zone lets the last stage reclaim the tail to end", () => {
    const withRest = clip({
      stageRefs: [stage("A"), stage("B")],
      boundaries: [{ id: "b0", frame: 30, cue: "animationBreak" }],
      restStart: 70,
    })
    const next = applyClipEdit(withRest, { type: "removeRestZone" })
    expect(next.restStart).toBeUndefined()
    expect(sections(next)[1].end).toBe(100)
  })

  it("clamps the last boundary against restStart, not end", () => {
    const withRest = clip({
      stageRefs: [stage("A"), stage("B")],
      boundaries: [{ id: "b0", frame: 30, cue: "animationBreak" }],
      restStart: 70,
    })
    const moved = applyClipEdit(withRest, {
      type: "moveBoundary",
      index: 0,
      frame: 999,
    })
    expect(moved.boundaries[0].frame).toBe(69)
  })

  it("places a hit owned by the stage it lands in, clamped into the clip", () => {
    const next = applyClipEdit(capped, {
      type: "addHit",
      hit: { id: "h", frame: 10, cue: "impactFlash" },
    })
    expect(next.hits[0]).toEqual({
      id: "h",
      frame: 10,
      cue: "impactFlash",
      owner: 0,
    })
  })

  it("rejects a hit placed in the rest zone", () => {
    const withRest = clip({
      stageRefs: [stage("A", 2)],
      restStart: 40,
    })
    const rejected = applyClipEdit(withRest, {
      type: "addHit",
      hit: { id: "h", frame: 60, cue: "impactFlash" },
    })
    expect(rejected).toBe(withRest)
  })

  it("rejects a hit that would exceed the owning stage's capacity", () => {
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

  it("drags a hit across a boundary without re-homing or a capacity check", () => {
    const c = clip({
      stageRefs: [stage("A", 1), stage("B", 1)],
      boundaries: [{ id: "b0", frame: 50, cue: "animationBreak" }],
      hits: [hit("a", 10, 0), hit("b", 60, 1)],
    })
    // Drag A's hit into B's frames; B is full, but ownership is sticky so it holds.
    const next = applyClipEdit(c, { type: "moveHit", id: "a", frame: 70 })
    const moved = next.hits.find((h) => h.id === "a")!
    expect(moved.frame).toBe(70)
    expect(moved.owner).toBe(0)
    expect(hitsInStage(next, 0)).toBe(1)
    expect(hitsInStage(next, 1)).toBe(1)
  })

  it("removing a middle stage drops its hits and shifts later owners down", () => {
    const c = clip({
      ...threeStage,
      hits: [hit("a", 10, 0), hit("b", 50, 1), hit("c", 80, 2)],
    })
    const next = applyClipEdit(c, { type: "removeStage", index: 1 })
    expect(next.hits.map((h) => [h.id, h.owner])).toEqual([
      ["a", 0],
      ["c", 1],
    ])
  })

  it("removing the last stage opens a rest zone and keeps trailing hits there", () => {
    const c = clip({
      ...threeStage,
      hits: [hit("a", 10, 0), hit("trailing", 80, 0), hit("c", 90, 2)],
    })
    const next = applyClipEdit(c, { type: "removeStage", index: 2 })
    expect(next.restStart).toBe(70)
    expect(next.end).toBe(100)
    // c (owned by the removed stage) is dropped; the trailing hit survives in rest.
    expect(next.hits.map((h) => h.id).sort()).toEqual(["a", "trailing"])
    expect(stageIndexOf(next, 80)).toBe(-1)
  })

  it("removing the sole stage clears the rest zone and its hits", () => {
    const c = clip({ stageRefs: [stage("A")], hits: [hit("a", 10, 0)] })
    const next = applyClipEdit(c, { type: "removeStage", index: 0 })
    expect(next.stageRefs).toHaveLength(0)
    expect(next.hits).toHaveLength(0)
    expect(next.restStart).toBeUndefined()
  })

  it("appending a stage overwrites the rest zone with the new stage", () => {
    const c = clip({
      stageRefs: [stage("A"), stage("B")],
      boundaries: [{ id: "b0", frame: 30, cue: "animationBreak" }],
      restStart: 70,
      hits: [hit("trailing", 80, 0)],
    })
    const next = applyClipEdit(c, {
      type: "addStage",
      ref: stage("D"),
      boundaryId: "b1",
    })
    expect(next.restStart).toBeUndefined()
    expect(next.boundaries.map((b) => b.frame)).toEqual([30, 70])
    // The new stage takes [70,100]; the trailing hit is now displaced into it.
    expect(stageIndexOf(next, 80)).toBe(2)
    expect(next.hits[0].owner).toBe(0)
  })

  it("clamps End so it cannot cross inward of a hit", () => {
    const c = clip({
      stageRefs: [stage("A"), stage("B")],
      boundaries: [{ id: "b0", frame: 30, cue: "animationBreak" }],
      hits: [hit("h", 90, 1)],
    })
    const next = applyClipEdit(c, { type: "setEnd", frame: 50 })
    expect(next.end).toBe(91)
  })

  it("sets and clears a variant pin, dropping the empty record", () => {
    const set = applyClipEdit(threeStage, {
      type: "setVariant",
      stageIndex: 1,
      track: "swap",
      target: { kind: "hit", n: 2 },
    })
    expect(set.variants).toEqual({ 1: { swap: { kind: "hit", n: 2 } } })
    const cleared = applyClipEdit(set, {
      type: "clearVariant",
      stageIndex: 1,
      track: "swap",
    })
    expect(cleared.variants).toBeUndefined()
  })

  it("ignores a variant edit on an out-of-range stage", () => {
    const next = applyClipEdit(threeStage, {
      type: "setVariant",
      stageIndex: 9,
      track: "cancel",
      target: { kind: "last" },
    })
    expect(next).toBe(threeStage)
  })

  it("drops a removed stage's pins and shifts higher occurrences down", () => {
    const c = clip({
      ...threeStage,
      variants: {
        0: { cancel: { kind: "last" } },
        1: { swap: { kind: "start" } },
        2: { cancel: { kind: "hit", n: 1 } },
      },
    })
    const next = applyClipEdit(c, { type: "removeStage", index: 1 })
    expect(next.variants).toEqual({
      0: { cancel: { kind: "last" } },
      1: { cancel: { kind: "hit", n: 1 } },
    })
  })
})

describe("resolveVariantTarget", () => {
  const c = clip({
    stageRefs: [stage("A", 3)],
    hits: [hit("h1", 10, 0), hit("h2", 25, 0), hit("h3", 60, 0)],
  })

  it("last tracks the highest-frame placed hit, relative to the stage start", () => {
    expect(resolveVariantTarget(c, 0, { kind: "last" })).toEqual({
      ok: true,
      actionTime: 60,
    })
  })

  it("a hit ordinal resolves to that hit's actionFrame", () => {
    expect(resolveVariantTarget(c, 0, { kind: "hit", n: 2 })).toEqual({
      ok: true,
      actionTime: 25,
    })
  })

  it("fails when the pinned hit isn't placed", () => {
    expect(resolveVariantTarget(c, 0, { kind: "hit", n: 4 }).ok).toBe(false)
    const empty = clip({ stageRefs: [stage("A", 2)] })
    expect(resolveVariantTarget(empty, 0, { kind: "last" }).ok).toBe(false)
  })
})
