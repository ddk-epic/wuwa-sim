import { describe, expect, it } from "vitest"
import type { DamageEntry, EnrichedSkillAttribute } from "#/types/character"
import { nextVariant, resolveStageExecution } from "./stage"
import type { ActionTimeStage } from "./stage"

function makeStage(
  actionTime: number,
  variants?: EnrichedSkillAttribute["variants"],
  damage: EnrichedSkillAttribute["damage"] = [],
): EnrichedSkillAttribute {
  return {
    name: "Stage",
    category: "Basic Attack",
    value: "100%",
    actionTime,
    damage,
    variants,
  }
}

describe("resolveStageExecution — full stage (no variant)", () => {
  it("returns stage.actionTime as advance when variantKind is undefined", () => {
    expect(resolveStageExecution(makeStage(50), undefined, 9).advance).toBe(50)
  })

  it("falls back to stage.actionTime when variantKind not on stage", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "instantCancel", 9).advance).toBe(50)
  })

  it("falls back to stage.actionTime when stage has no variants", () => {
    expect(
      resolveStageExecution(makeStage(50, undefined), "cancel", 9).advance,
    ).toBe(50)
  })
})

describe("resolveStageExecution — cancel variant", () => {
  it("returns variant.actionTime + reactionDelay as advance", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "cancel", 9).advance).toBe(42)
  })

  it("varies with reactionDelay", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "cancel", 0).advance).toBe(33)
    expect(resolveStageExecution(stage, "cancel", 5).advance).toBe(38)
  })
})

describe("resolveStageExecution — instantCancel variant", () => {
  it("returns variant.actionTime + reactionDelay as advance", () => {
    const stage = makeStage(50, {
      cancel: { actionTime: 33 },
      instantCancel: { actionTime: 7 },
    })
    expect(resolveStageExecution(stage, "instantCancel", 9).advance).toBe(16)
  })
})

describe("resolveStageExecution — swap variant", () => {
  it("uses authored actionTime + reactionDelay when variants.swap is defined", () => {
    const stage = makeStage(50, { swap: { actionTime: 10 } })
    expect(resolveStageExecution(stage, "swap", 6, 6).advance).toBe(16)
  })

  it("falls back to swapFrames when no variants.swap authored", () => {
    const stage = makeStage(50, undefined)
    expect(resolveStageExecution(stage, "swap", 6, 6).advance).toBe(6)
  })

  it("returns all damage unfiltered even when actionFrame > advance", () => {
    const damage: DamageEntry[] = [
      {
        type: "Basic Attack",
        dmgType: "Damage",
        scalingStat: "ATK",
        actionFrame: 5,
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
        actionFrame: 40,
        value: 200,
        energy: 0,
        concerto: 0,
        toughness: 0,
        weakness: 0,
      },
    ]
    const stage = makeStage(50, { swap: { actionTime: 10 } }, damage)
    const { hits } = resolveStageExecution(stage, "swap", 6, 6)
    expect(hits).toHaveLength(2)
  })

  it("authored swap advance respects different swapFrames fallback values", () => {
    const stage = makeStage(50, undefined)
    expect(resolveStageExecution(stage, "swap", 6, 12).advance).toBe(12)
    expect(resolveStageExecution(stage, "swap", 6, 0).advance).toBe(0)
  })
})

describe("resolveStageExecution — damage filtering", () => {
  it("returns all damage when no variant", () => {
    const damage: DamageEntry[] = [
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
    expect(resolveStageExecution(stage, undefined, 9).hits).toHaveLength(2)
  })

  it("filters hits beyond variant cutoff", () => {
    const damage: DamageEntry[] = [
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
    const { hits: filtered } = resolveStageExecution(stage, "cancel", 9)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].actionFrame).toBe(10)
  })
})

describe("resolveStageExecution — independent flag (#217)", () => {
  const baseDamage = (
    actionFrame: number,
    independent?: boolean,
  ): DamageEntry => ({
    type: "Basic Attack",
    dmgType: "Damage",
    scalingStat: "ATK",
    actionFrame,
    value: 1,
    energy: 0,
    concerto: 0,
    toughness: 0,
    weakness: 0,
    ...(independent ? { independent } : {}),
  })

  it("flagged entry survives cancel past cutoff", () => {
    const damage = [baseDamage(10), baseDamage(90, true)]
    const stage = makeStage(107, { cancel: { actionTime: 54 } }, damage)
    const { hits } = resolveStageExecution(stage, "cancel", 9)
    expect(hits).toHaveLength(2)
    expect(hits.find((h) => h.actionFrame === 90)).toBeDefined()
  })

  it("flagged entry survives instantCancel past cutoff", () => {
    const damage = [baseDamage(10), baseDamage(90, true)]
    const stage = makeStage(107, { instantCancel: { actionTime: 20 } }, damage)
    const { hits } = resolveStageExecution(stage, "instantCancel", 9)
    expect(hits).toHaveLength(2)
    expect(hits.find((h) => h.actionFrame === 90)).toBeDefined()
  })

  it("unflagged entries beyond cutoff are still truncated", () => {
    const damage = [baseDamage(10), baseDamage(90), baseDamage(90, true)]
    const stage = makeStage(107, { cancel: { actionTime: 54 } }, damage)
    const { hits } = resolveStageExecution(stage, "cancel", 9)
    // frame-10 survives, frame-90 unflagged truncated, frame-90 flagged survives
    expect(hits).toHaveLength(2)
    expect(hits[0].actionFrame).toBe(10)
    expect(hits[1].independent).toBe(true)
  })

  it("flag is inert on full execution (no variant)", () => {
    const damage = [baseDamage(10), baseDamage(90, true)]
    const stage = makeStage(107, { cancel: { actionTime: 54 } }, damage)
    const { hits } = resolveStageExecution(stage, undefined, 9)
    expect(hits).toHaveLength(2)
  })
})

describe("resolveStageExecution — react value", () => {
  it("returns react=0 when no variant", () => {
    expect(resolveStageExecution(makeStage(50), undefined, 9).react).toBe(0)
  })

  it("returns react=reactionDelay for cancel with stage-authored variant", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "cancel", 9).react).toBe(9)
  })

  it("returns react=0 for cancel when stage does not author the variant", () => {
    const stage = makeStage(50, undefined)
    expect(resolveStageExecution(stage, "cancel", 9).react).toBe(0)
  })

  it("returns react=reactionDelay for swap with stage-authored variants.swap", () => {
    const stage = makeStage(50, { swap: { actionTime: 10 } })
    expect(resolveStageExecution(stage, "swap", 6, 6).react).toBe(6)
  })

  it("returns react=0 for swap falling back to swapFrames", () => {
    const stage = makeStage(50, undefined)
    expect(resolveStageExecution(stage, "swap", 6, 6).react).toBe(0)
  })
})

describe("resolveStageExecution — variantFloor", () => {
  it("floor wins: actionTime=0, react=6, floor=15 -> advance=15, floor=15, react=0", () => {
    const stage = makeStage(50, { cancel: { actionTime: 0 } })
    const result = resolveStageExecution(stage, "cancel", 6, 6, 15)
    expect(result.advance).toBe(15)
    expect(result.floor).toBe(15)
    expect(result.react).toBe(0)
  })

  it("react wins: actionTime=30, react=6, floor=15 -> advance=36, react=6, floor=0", () => {
    const stage = makeStage(50, { cancel: { actionTime: 30 } })
    const result = resolveStageExecution(stage, "cancel", 6, 6, 15)
    expect(result.advance).toBe(36)
    expect(result.react).toBe(6)
    expect(result.floor).toBe(0)
  })

  it("swap authored: floor wins when floor > actionTime + react", () => {
    const stage = makeStage(50, { swap: { actionTime: 0 } })
    const result = resolveStageExecution(stage, "swap", 6, 6, 15)
    expect(result.advance).toBe(15)
    expect(result.floor).toBe(15)
    expect(result.react).toBe(0)
  })

  it("swap unauthored fallback: floor does not apply to swapFrames path", () => {
    const stage = makeStage(50, undefined)
    const result = resolveStageExecution(stage, "swap", 6, 6, 15)
    expect(result.advance).toBe(6)
    expect(result.floor).toBe(0)
    expect(result.react).toBe(0)
  })

  it("variantFloor=0 disables flooring (react wins at tie or above)", () => {
    const stage = makeStage(50, { cancel: { actionTime: 0 } })
    const result = resolveStageExecution(stage, "cancel", 6, 6, 0)
    expect(result.advance).toBe(6)
    expect(result.react).toBe(6)
    expect(result.floor).toBe(0)
  })

  it("instantCancel with floor wins", () => {
    const stage = makeStage(50, { instantCancel: { actionTime: 0 } })
    const result = resolveStageExecution(stage, "instantCancel", 6, 6, 15)
    expect(result.advance).toBe(15)
    expect(result.floor).toBe(15)
    expect(result.react).toBe(0)
  })

  it("floor raises damage cutoff: hit at actionFrame=10 survives under floor=15", () => {
    const damage: DamageEntry[] = [
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
    ]
    // actionTime=0 + react=6 = 6 < 10, so without floor the hit would be dropped
    // with floor=15 the advance becomes 15, so 10 <= 15 passes
    const stage = makeStage(50, { cancel: { actionTime: 0 } }, damage)
    const withFloor = resolveStageExecution(stage, "cancel", 6, 6, 15)
    expect(withFloor.hits).toHaveLength(1)
    const withoutFloor = resolveStageExecution(stage, "cancel", 6, 6, 0)
    expect(withoutFloor.hits).toHaveLength(0)
  })
})

describe("nextVariant — full cycle", () => {
  const stageAllVariants: ActionTimeStage = {
    actionTime: 50,
    variants: {
      cancel: { actionTime: 33 },
      instantCancel: { actionTime: 7 },
      swap: { actionTime: 10 },
    },
  }
  const stageCancelOnly: ActionTimeStage = {
    actionTime: 50,
    variants: { cancel: { actionTime: 33 } },
  }
  const stageSwapOnly: ActionTimeStage = {
    actionTime: 50,
    variants: { swap: { actionTime: 10 } },
  }
  const stageNoVariants: ActionTimeStage = {
    actionTime: 50,
  }

  it("cycles FULL → CNCL → INST → SWAP → FULL when all variants present", () => {
    expect(nextVariant(undefined, stageAllVariants)).toBe("cancel")
    expect(nextVariant("cancel", stageAllVariants)).toBe("instantCancel")
    expect(nextVariant("instantCancel", stageAllVariants)).toBe("swap")
    expect(nextVariant("swap", stageAllVariants)).toBeUndefined()
  })

  it("skips undefined variants: cancel-only cycles FULL → CNCL → FULL", () => {
    expect(nextVariant(undefined, stageCancelOnly)).toBe("cancel")
    expect(nextVariant("cancel", stageCancelOnly)).toBeUndefined()
  })

  it("skips undefined variants: swap-only cycles FULL → SWAP → FULL", () => {
    expect(nextVariant(undefined, stageSwapOnly)).toBe("swap")
    expect(nextVariant("swap", stageSwapOnly)).toBeUndefined()
  })

  it("stage with no variants stays at FULL (only undefined in defined list)", () => {
    expect(nextVariant(undefined, stageNoVariants)).toBeUndefined()
  })
})
