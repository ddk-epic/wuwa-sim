import { describe, expect, it } from "vitest"
import { projectStages, projectionOf } from "./projection"
import { reconcile } from "./reconcile"
import type { Clip, HitMark } from "./clip"
import type { StageRef } from "./stage-ref"

const ref = (name: string, hitCount: number): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount,
})

const hit = (id: string, frame: number, owner: number): HitMark => ({
  id,
  frame,
  cue: "impactFlash",
  owner,
})

function clip(over: Partial<Clip> = {}): Clip {
  return {
    id: "c1",
    name: "",
    start: 0,
    end: 100,
    stageRefs: [ref("A", 2), ref("B", 1)],
    boundaries: [{ id: "b0", frame: 40, cue: "animationBreak" }],
    hits: [hit("a0", 10, 0), hit("a1", 25, 0), hit("b0", 70, 1)],
    ...over,
  }
}

const project = (clips: Clip[]) => projectStages(clips, reconcile(clips))

describe("projectStages", () => {
  it("picks the best clip by hit count and projects its hits", () => {
    const sparse = clip({
      id: "c1",
      stageRefs: [ref("A", 2)],
      boundaries: [],
      hits: [hit("a0", 10, 0)],
      end: 40,
    })
    const full = clip({
      id: "c2",
      stageRefs: [ref("A", 2)],
      boundaries: [],
      hits: [hit("x0", 12, 0), hit("x1", 30, 0)],
      end: 40,
    })
    const p = projectionOf(project([sparse, full]), "skill::A")
    expect(p.best?.clipId).toBe("c2")
    expect(p.hits.map((h) => h.actionFrame)).toEqual([12, 30])
  })

  it("reads a repeated stage from its first occurrence only", () => {
    const repeated = clip({
      stageRefs: [ref("A", 2), ref("A", 2)],
      hits: [hit("a0", 10, 0), hit("a1", 25, 0)],
    })
    const p = projectionOf(project([repeated]), "skill::A")
    expect(p.best?.index).toBe(0)
    expect(p.hits.map((h) => h.actionFrame)).toEqual([10, 25])
  })

  it("projects a split stage's hits to 0 and reports its frozen leading slice", () => {
    const split = clip({
      animationSplits: [{ frame: 12, cue: "vfxEdge" }, null],
    })
    const p = projectionOf(project([split]), "skill::A")
    expect(p.animationFrames).toBe(12)
    expect(p.hits.map((h) => h.actionFrame)).toEqual([0, 0])
  })

  it("defaults an absent stage to unmeasured and empty", () => {
    const p = projectionOf(project([clip()]), "skill::missing")
    expect(p.status.status).toBe("unmeasured")
    expect(p.best).toBeNull()
    expect(p.hits).toEqual([])
    expect(p.animationFrames).toBeNull()
    expect(p.variants).toEqual({})
  })
})

describe("projectStages variants", () => {
  it("leaves a track absent when no clip pins it", () => {
    const p = projectionOf(project([clip()]), "skill::A")
    expect(p.variants.cancel).toBeUndefined()
    expect(p.variants.swap).toBeUndefined()
  })

  it("agrees and resolves a pin against the best clip's hits", () => {
    const pinned = clip({
      id: "c1",
      stageRefs: [ref("A", 2)],
      boundaries: [],
      hits: [hit("a0", 10, 0)],
      end: 40,
      variants: { 0: { cancel: { kind: "last" } } },
    })
    const full = clip({
      id: "c2",
      stageRefs: [ref("A", 2)],
      boundaries: [],
      hits: [hit("x0", 12, 0), hit("x1", 30, 0)],
      end: 40,
    })
    const p = projectionOf(project([pinned, full]), "skill::A")
    const track = p.variants.cancel
    expect(track?.agreed).toBe(true)
    if (track?.agreed) {
      expect(track.target).toEqual({ kind: "last" })
      expect(track.resolution).toEqual({ ok: true, actionTime: 30 })
    }
  })

  it("reports disagreement when clips pin different targets", () => {
    const a = clip({
      id: "c1",
      stageRefs: [ref("A", 2)],
      boundaries: [],
      hits: [hit("a0", 10, 0), hit("a1", 25, 0)],
      end: 40,
      variants: { 0: { cancel: { kind: "hit", n: 1 } } },
    })
    const b = clip({
      id: "c2",
      stageRefs: [ref("A", 2)],
      boundaries: [],
      hits: [hit("x0", 12, 0), hit("x1", 30, 0)],
      end: 40,
      variants: { 0: { cancel: { kind: "hit", n: 2 } } },
    })
    const track = projectionOf(project([a, b]), "skill::A").variants.cancel
    expect(track?.agreed).toBe(false)
    if (track && !track.agreed)
      expect(track.targets).toEqual([
        { kind: "hit", n: 1 },
        { kind: "hit", n: 2 },
      ])
  })

  it("marks a dangling pin as unresolved", () => {
    const pinned = clip({
      stageRefs: [ref("A", 2), ref("B", 1)],
      variants: { 0: { swap: { kind: "hit", n: 5 } } },
    })
    const track = projectionOf(project([pinned]), "skill::A").variants.swap
    expect(track?.agreed).toBe(true)
    if (track?.agreed) expect(track.resolution.ok).toBe(false)
  })
})
