import { describe, expect, it } from "vitest"
import type { EnrichedSkillAttribute } from "#/types/character"
import { resolveStageExecution } from "./stage"

function makeStage(
  actionTime: number,
  variants?: EnrichedSkillAttribute["variants"],
  damage: EnrichedSkillAttribute["damage"] = [],
): EnrichedSkillAttribute {
  return { name: "Stage", value: "100%", actionTime, damage, variants }
}

describe("resolveStageExecution — full stage (no variant)", () => {
  it("returns stage.actionTime as duration when variantKind is undefined", () => {
    expect(resolveStageExecution(makeStage(50), undefined, 9).duration).toBe(50)
  })

  it("falls back to stage.actionTime when variantKind not on stage", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "instantCancel", 9).duration).toBe(50)
  })

  it("falls back to stage.actionTime when stage has no variants", () => {
    expect(
      resolveStageExecution(makeStage(50, undefined), "cancel", 9).duration,
    ).toBe(50)
  })
})

describe("resolveStageExecution — cancel variant", () => {
  it("returns variant.actionTime + reactionDelay as duration", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "cancel", 9).duration).toBe(42)
  })

  it("varies with reactionDelay", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "cancel", 0).duration).toBe(33)
    expect(resolveStageExecution(stage, "cancel", 5).duration).toBe(38)
  })
})

describe("resolveStageExecution — instantCancel variant", () => {
  it("returns variant.actionTime + reactionDelay as duration", () => {
    const stage = makeStage(50, {
      cancel: { actionTime: 33 },
      instantCancel: { actionTime: 7 },
    })
    expect(resolveStageExecution(stage, "instantCancel", 9).duration).toBe(16)
  })
})

describe("resolveStageExecution — damage filtering", () => {
  it("returns all damage when no variant", () => {
    const damage = [
      {
        type: "Basic Attack",
        dmgType: "Damage",
        scalingStat: "ATK",
        actionFrame: 10,
        value: 100,
        energy: 0,
        concerto: 0,
        toughness: 0,
        weakness: 0,
      },
      {
        type: "Basic Attack",
        dmgType: "Damage",
        scalingStat: "ATK",
        actionFrame: 30,
        value: 200,
        energy: 0,
        concerto: 0,
        toughness: 0,
        weakness: 0,
      },
    ]
    const stage = makeStage(50, undefined, damage)
    expect(resolveStageExecution(stage, undefined, 9).damage).toHaveLength(2)
  })

  it("filters hits beyond variant cutoff", () => {
    const damage = [
      {
        type: "Basic Attack",
        dmgType: "Damage",
        scalingStat: "ATK",
        actionFrame: 10,
        value: 100,
        energy: 0,
        concerto: 0,
        toughness: 0,
        weakness: 0,
      },
      {
        type: "Basic Attack",
        dmgType: "Damage",
        scalingStat: "ATK",
        actionFrame: 50,
        value: 200,
        energy: 0,
        concerto: 0,
        toughness: 0,
        weakness: 0,
      },
    ]
    const stage = makeStage(60, { cancel: { actionTime: 33 } }, damage)
    const { damage: filtered } = resolveStageExecution(stage, "cancel", 9)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].actionFrame).toBe(10)
  })
})
