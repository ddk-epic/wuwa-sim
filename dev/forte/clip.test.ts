import { describe, expect, it } from "vitest"
import { applyForteEdit, clipDisplayName } from "./clip"
import type { ForteClip } from "./clip"
import type { StageRef } from "../frames/stage-ref"

const stage = (name: string): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount: 0,
})

function clip(over: Partial<ForteClip> = {}): ForteClip {
  return { id: "c1", name: "", start: 0, end: 60, stageRefs: [], ...over }
}

describe("clipDisplayName", () => {
  it("uses an explicit name over the derived sequence", () => {
    const c = clip({ name: "custom", stageRefs: [stage("b1")] })
    expect(clipDisplayName(c)).toBe("custom")
  })

  it("derives from the stage sequence when unnamed", () => {
    const c = clip({ stageRefs: [stage("b1"), stage("b1"), stage("b1")] })
    expect(clipDisplayName(c)).toBe("b1›b1›b1")
  })
})

describe("applyForteEdit sequence", () => {
  it("appends and removes stages by index", () => {
    let c = applyForteEdit(clip(), { type: "addStage", ref: stage("a") })
    c = applyForteEdit(c, { type: "addStage", ref: stage("b") })
    c = applyForteEdit(c, { type: "addStage", ref: stage("c") })
    c = applyForteEdit(c, { type: "removeStage", index: 1 })
    expect(c.stageRefs.map((r) => r.stage)).toEqual(["a", "c"])
  })

  it("freezes stage add/remove while stagesLocked but still toggles the lock", () => {
    const c = clip({ stageRefs: [stage("a")], stagesLocked: true })
    expect(applyForteEdit(c, { type: "addStage", ref: stage("b") })).toBe(c)
    expect(applyForteEdit(c, { type: "removeStage", index: 0 })).toBe(c)
    expect(applyForteEdit(c, { type: "toggleStagesLock" }).stagesLocked).toBe(
      false,
    )
  })
})

describe("applyForteEdit scoping", () => {
  it("scopeRecording spans the whole recording and clears the offset", () => {
    const c = applyForteEdit(clip({ offset: 5 }), {
      type: "scopeRecording",
      frames: 120,
    })
    expect(c).toMatchObject({ start: 0, end: 119, offset: undefined })
  })

  it("lockScope normalizes to a 0-based window and enterScope inverts it", () => {
    const locked = applyForteEdit(clip({ start: 30, end: 90 }), {
      type: "lockScope",
    })
    expect(locked).toMatchObject({ start: 0, end: 60, offset: 30 })
    expect(applyForteEdit(locked, { type: "enterScope" })).toMatchObject({
      start: 30,
      end: 90,
      offset: undefined,
    })
  })

  it("setEnd floors above the start", () => {
    const c = applyForteEdit(clip({ start: 10, end: 60 }), {
      type: "setEnd",
      frame: 5,
    })
    expect(c.end).toBe(11)
  })
})

describe("applyForteEdit calibration", () => {
  const cal = { empty: { x: 0.2, y: 0.8 }, full: { x: 0.7, y: 0.8 } }

  it("stores the calibration axis on the clip", () => {
    expect(
      applyForteEdit(clip(), { type: "setCalibration", calibration: cal }),
    ).toMatchObject({ calibration: cal })
  })

  it("sets calibration even while the sequence is locked", () => {
    const c = clip({ stagesLocked: true })
    expect(
      applyForteEdit(c, { type: "setCalibration", calibration: cal })
        .calibration,
    ).toEqual(cal)
  })
})
