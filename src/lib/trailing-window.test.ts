import { describe, it, expect } from "vitest"
import type { DamageEntry, SkillType } from "#/types/character"
import type { TimelineEntry } from "#/types/timeline"
import { isCancelCapable, partitionStage } from "./trailing-window"
import { makeResolvedStage } from "./stage.test-utils"

/**
 * `trailing-window` is now a pair of pure helpers (ADR-0028 endgame): the
 * stateful per-character Map dissolved onto the simulation's frame-ordered
 * pending stream, so collision drop/pad behavior is covered by the simulation
 * integration tests (`simulation.test.ts` — trailing-window collision). What
 * remains here is the stage partition (immediate vs trailing + deferred footing)
 * and the cancel-capability predicate.
 */

function makeDamageEntry(actionFrame: number): DamageEntry {
  return {
    type: "Basic Attack",
    dmgType: "Damage",
    scalingStat: "ATK",
    actionFrame,
    value: 1,
    energy: 0,
    concerto: 0,
    toughness: 0,
    weakness: 0,
  }
}

function makeEntry(characterId: number): TimelineEntry {
  return { id: `e${characterId}`, characterId, stageId: "Normal Attack::_" }
}

const stubResolved = makeResolvedStage()

describe("trailing-window — isCancelCapable", () => {
  it("is true for the cancel-capable skill types", () => {
    for (const skillType of [
      "Resonance Skill",
      "Resonance Liberation",
      "Intro Skill",
      "Outro Skill",
      "Echo Skill",
    ] as const) {
      expect(isCancelCapable(skillType)).toBe(true)
    }
  })

  it("is false for non-cancel-capable skill types", () => {
    for (const skillType of [
      "Basic Attack",
      "Heavy Attack",
      "Movement",
    ] as const) {
      expect(isCancelCapable(skillType as SkillType)).toBe(false)
    }
  })
})

describe("trailing-window — partitionStage: swap partition cutoff", () => {
  it("hits with actionFrame > stageDuration become trailing; others are immediate", () => {
    const entry = makeEntry(1)
    const hits = [makeDamageEntry(2), makeDamageEntry(6), makeDamageEntry(9)]
    const result = partitionStage({
      entry,
      resolved: stubResolved,
      stageStartFrame: 0,
      hits,
      variantKind: "swap",
      stageDuration: 5,
    })
    expect(result.immediate).toHaveLength(1)
    expect(result.immediate[0].hit.actionFrame).toBe(2)
    expect(result.trailing).toHaveLength(2)
    expect(result.trailing[0].hit.actionFrame).toBe(6)
    expect(result.trailing[1].hit.actionFrame).toBe(9)
    // hitFrame = stageStartFrame + actionFrame
    expect(result.trailing[0].hitFrame).toBe(6)
  })

  it("when all hits within stageDuration, trailing is empty", () => {
    const result = partitionStage({
      entry: makeEntry(1),
      resolved: stubResolved,
      stageStartFrame: 0,
      hits: [makeDamageEntry(1), makeDamageEntry(3)],
      variantKind: "swap",
      stageDuration: 5,
    })
    expect(result.immediate).toHaveLength(2)
    expect(result.trailing).toHaveLength(0)
  })
})

describe("trailing-window — partitionStage: non-swap partition", () => {
  it("all hits go to immediate; trailing empty for non-swap variantKind", () => {
    const result = partitionStage({
      entry: makeEntry(1),
      resolved: stubResolved,
      stageStartFrame: 0,
      hits: [makeDamageEntry(2), makeDamageEntry(6)],
      variantKind: undefined,
      stageDuration: 5,
    })
    expect(result.immediate).toHaveLength(2)
    expect(result.trailing).toHaveLength(0)
    expect(result.pendingFooting).toBeUndefined()
  })
})

describe("trailing-window — partitionStage: pendingFooting", () => {
  it("adds pendingFooting when swap stage has {launch:N} with N > stageDuration", () => {
    const resolved = makeResolvedStage({
      stage: { actionTime: 0, footing: { launch: 15 } },
    })
    const result = partitionStage({
      entry: makeEntry(1),
      resolved,
      stageStartFrame: 10,
      hits: [],
      variantKind: "swap",
      stageDuration: 6,
    })
    expect(result.pendingFooting).toEqual({ atFrame: 25, exitFooting: "air" })
  })

  it("no pendingFooting when {launch:N} with N <= stageDuration (fires on-field)", () => {
    const resolved = makeResolvedStage({
      stage: { actionTime: 0, footing: { launch: 5 } },
    })
    const result = partitionStage({
      entry: makeEntry(1),
      resolved,
      stageStartFrame: 0,
      hits: [],
      variantKind: "swap",
      stageDuration: 6,
    })
    expect(result.pendingFooting).toBeUndefined()
  })

  it("adds pendingFooting for {land:N} when N > stageDuration", () => {
    const resolved = makeResolvedStage({
      stage: { actionTime: 0, footing: { land: 20 } },
    })
    const result = partitionStage({
      entry: makeEntry(1),
      resolved,
      stageStartFrame: 0,
      hits: [],
      variantKind: "swap",
      stageDuration: 6,
    })
    expect(result.pendingFooting).toEqual({
      atFrame: 20,
      exitFooting: "ground",
    })
  })

  it("no pendingFooting for non-swap stages (even with {launch:N})", () => {
    const resolved = makeResolvedStage({
      stage: { actionTime: 0, footing: { launch: 15 } },
    })
    const result = partitionStage({
      entry: makeEntry(1),
      resolved,
      stageStartFrame: 0,
      hits: [makeDamageEntry(5)],
      variantKind: undefined,
      stageDuration: 30,
    })
    expect(result.pendingFooting).toBeUndefined()
  })
})
