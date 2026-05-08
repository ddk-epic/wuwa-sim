import { describe, expect, it } from "vitest"
import type { EnrichedSkillAttribute } from "#/types/character"
import { resolveActionTime } from "./resolve-action-time"

function makeStage(
  actionTime: number,
  variants?: EnrichedSkillAttribute["variants"],
): EnrichedSkillAttribute {
  return { name: "Stage", value: "100%", actionTime, damage: [], variants }
}

describe("resolveActionTime — full stage", () => {
  it("returns stage.actionTime when variantKind is undefined", () => {
    expect(resolveActionTime(makeStage(50), undefined, 9)).toBe(50)
  })

  it("falls back to stage.actionTime when variantKind not on stage", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveActionTime(stage, "instantCancel", 9)).toBe(50)
  })

  it("falls back to stage.actionTime when stage has no variants", () => {
    expect(resolveActionTime(makeStage(50, undefined), "cancel", 9)).toBe(50)
  })
})

describe("resolveActionTime — cancel variant", () => {
  it("returns variant.actionTime + reactionDelay", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveActionTime(stage, "cancel", 9)).toBe(42)
  })

  it("varies with reactionDelay", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveActionTime(stage, "cancel", 0)).toBe(33)
    expect(resolveActionTime(stage, "cancel", 5)).toBe(38)
  })
})

describe("resolveActionTime — instantCancel variant", () => {
  it("returns variant.actionTime + reactionDelay", () => {
    const stage = makeStage(50, {
      cancel: { actionTime: 33 },
      instantCancel: { actionTime: 7 },
    })
    expect(resolveActionTime(stage, "instantCancel", 9)).toBe(16)
  })
})
