// @vitest-environment node
import { describe, expect, it } from "vitest"
import { applyForteEdit, clipDisplayName } from "./clip"
import type { ForteClip, ForteSlot } from "./clip"
import type { StageRef } from "../frames/stage-ref"
import type { Point } from "./calibration"

const stage = (name: string): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount: 0,
})

const slot = (name: string, reading?: Point): ForteSlot => ({
  id: `slot-${name}`,
  ref: stage(name),
  reading,
})

function clip(over: Partial<ForteClip> = {}): ForteClip {
  return { id: "c1", name: "", slots: [], ...over }
}

describe("clipDisplayName", () => {
  it("uses an explicit name over the derived sequence", () => {
    expect(clipDisplayName(clip({ name: "custom", slots: [slot("b1")] }))).toBe(
      "custom",
    )
  })

  it("derives from the slot sequence when unnamed", () => {
    const c = clip({ slots: [slot("b1"), slot("b1"), slot("b1")] })
    expect(clipDisplayName(c)).toBe("b1›b1›b1")
  })
})

describe("applyForteEdit sequence", () => {
  it("appends and removes slots by index", () => {
    let c = applyForteEdit(clip(), {
      type: "addStage",
      id: "a",
      ref: stage("a"),
    })
    c = applyForteEdit(c, { type: "addStage", id: "b", ref: stage("b") })
    c = applyForteEdit(c, { type: "addStage", id: "c", ref: stage("c") })
    c = applyForteEdit(c, { type: "removeStage", index: 1 })
    expect(c.slots.map((s) => s.ref.stage)).toEqual(["a", "c"])
  })

  it("freezes slot add/remove while stagesLocked but still toggles the lock", () => {
    const c = clip({ slots: [slot("a")], stagesLocked: true })
    expect(
      applyForteEdit(c, { type: "addStage", id: "b", ref: stage("b") }),
    ).toBe(c)
    expect(applyForteEdit(c, { type: "removeStage", index: 0 })).toBe(c)
    expect(applyForteEdit(c, { type: "toggleStagesLock" }).stagesLocked).toBe(
      false,
    )
  })
})

describe("applyForteEdit calibration", () => {
  const cal = { empty: { x: 0.2, y: 0.8 }, full: { x: 0.7, y: 0.8 } }

  it("stores the calibration axis, even while the sequence is locked", () => {
    const c = clip({ stagesLocked: true })
    expect(
      applyForteEdit(c, { type: "setCalibration", calibration: cal })
        .calibration,
    ).toEqual(cal)
  })
})

describe("applyForteEdit readings", () => {
  const seqClip = () => clip({ slots: [slot("b1"), slot("b1")] })

  it("sets and clears a slot's clamped reading", () => {
    let c = applyForteEdit(seqClip(), {
      type: "setReading",
      index: 1,
      fill: { x: 1.4, y: 0.8 },
    })
    expect(c.slots[1].reading).toEqual({ x: 1, y: 0.8 })
    c = applyForteEdit(c, { type: "clearReading", index: 1 })
    expect(c.slots[1].reading).toBeUndefined()
  })

  it("sets readings even while the sequence is locked", () => {
    const c = applyForteEdit(
      { ...seqClip(), stagesLocked: true },
      { type: "setReading", index: 0, fill: { x: 0.5, y: 0.8 } },
    )
    expect(c.slots[0].reading).toEqual({ x: 0.5, y: 0.8 })
  })
})
