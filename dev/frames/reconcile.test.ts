import { describe, expect, it } from "vitest"
import { reconcile, statusOf } from "./reconcile"
import type { CueTag, Clip, StageRef } from "./types"

const ref = (name: string): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount: 0,
})

// A two-stage clip [A|B] over [0,end], split at `at` with the given divider cue.
function twoStage(id: string, at: number, end: number, cue: CueTag): Clip {
  return {
    id,
    name: "",
    start: 0,
    end,
    stageRefs: [ref("A"), ref("B")],
    boundaries: [{ id: `${id}-b`, frame: at, cue }],
    hits: [],
  }
}

const A = ref("A").id
const B = ref("B").id

describe("reconcile", () => {
  it("a stage seen once is single, valued at its section width", () => {
    const r = reconcile([twoStage("c1", 40, 100, "impactFlash")])
    expect(statusOf(r, A)).toMatchObject({ status: "single", actionTime: 40 })
    expect(statusOf(r, B)).toMatchObject({ status: "single", actionTime: 60 })
  })

  it("an untouched stage is unmeasured", () => {
    const r = reconcile([twoStage("c1", 40, 100, "impactFlash")])
    expect(statusOf(r, "skill::C")).toEqual({ status: "unmeasured" })
  })

  it("two clips that agree are confirmed", () => {
    const r = reconcile([
      twoStage("c1", 40, 100, "impactFlash"),
      twoStage("c2", 40, 90, "impactFlash"),
    ])
    expect(statusOf(r, A)).toMatchObject({
      status: "confirmed",
      actionTime: 40,
    })
  })

  it("agreement within ±1 still confirms", () => {
    const r = reconcile([
      twoStage("c1", 40, 100, "impactFlash"),
      twoStage("c2", 41, 100, "impactFlash"),
    ])
    expect(statusOf(r, A).status).toBe("confirmed")
  })

  it("same-trust readings beyond tolerance conflict, never averaged", () => {
    const r = reconcile([
      twoStage("c1", 40, 100, "impactFlash"),
      twoStage("c2", 35, 100, "impactFlash"),
    ])
    const a = statusOf(r, A)
    expect(a.status).toBe("conflict")
    if (a.status === "conflict") {
      expect(a.spread).toBe(5)
      expect([35, 40]).toContain(a.estimate)
    }
  })

  it("a higher-trust reading wins a cross-trust disagreement (no conflict)", () => {
    const r = reconcile([
      twoStage("c1", 40, 100, "impactFlash"),
      twoStage("c2", 30, 100, "estimate"),
    ])
    expect(statusOf(r, A)).toMatchObject({ status: "single", actionTime: 40 })
  })

  it("a lower-trust reading within tolerance corroborates the lead", () => {
    const r = reconcile([
      twoStage("c1", 40, 100, "impactFlash"),
      twoStage("c2", 40, 100, "estimate"),
    ])
    expect(statusOf(r, A)).toMatchObject({
      status: "confirmed",
      actionTime: 40,
    })
  })

  it("reads actionTime net of an animation split", () => {
    const clip = twoStage("c1", 40, 100, "impactFlash")
    clip.animationSplits = [{ frame: 12, cue: "vfxEdge" }, null]
    const r = reconcile([clip])
    expect(statusOf(r, A)).toMatchObject({ status: "single", actionTime: 28 })
  })

  it("counts only a stage's first occurrence in a clip", () => {
    const clip: Clip = {
      id: "c1",
      name: "",
      start: 0,
      end: 100,
      stageRefs: [ref("A"), ref("A")],
      boundaries: [{ id: "b", frame: 40, cue: "impactFlash" }],
      hits: [],
    }
    expect(statusOf(reconcile([clip]), A)).toMatchObject({
      status: "single",
      actionTime: 40,
    })
  })
})
