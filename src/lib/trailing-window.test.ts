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
  it("post-actionTime hits defer to trailing for non-swap stages too (frame-ordered background damage)", () => {
    // A non-swap stage whose hits outrun its actionTime (e.g. an Outro DoT): the
    // late hit must defer to the stream so a later earlier-framed cast resolves
    // ahead of it, instead of synchronously dragging the engine clock past it.
    const result = partitionStage({
      entry: makeEntry(1),
      resolved: stubResolved,
      stageStartFrame: 0,
      hits: [makeDamageEntry(2), makeDamageEntry(6)],
      variantKind: undefined,
      stageDuration: 5,
    })
    expect(result.immediate).toHaveLength(1)
    expect(result.immediate[0].hit.actionFrame).toBe(2)
    expect(result.trailing).toHaveLength(1)
    expect(result.trailing[0].hit.actionFrame).toBe(6)
    // footingChanges stay swap-only — the launch/land window is a swap concept.
    expect(result.footingChanges).toEqual([])
  })

  it("when all hits fit within actionTime, trailing is empty (no behavior change)", () => {
    const result = partitionStage({
      entry: makeEntry(1),
      resolved: stubResolved,
      stageStartFrame: 0,
      hits: [makeDamageEntry(2), makeDamageEntry(4)],
      variantKind: undefined,
      stageDuration: 5,
    })
    expect(result.immediate).toHaveLength(2)
    expect(result.trailing).toHaveLength(0)
  })
})

describe("trailing-window — partitionStage: footingChanges", () => {
  it("launch past advance → [commit@(start+launch), reset@(start+actionTime)]", () => {
    const resolved = makeResolvedStage({
      stage: { actionTime: 18, footing: { launch: 15 } },
    })
    const result = partitionStage({
      entry: makeEntry(1),
      resolved,
      stageStartFrame: 10,
      hits: [],
      variantKind: "swap",
      stageDuration: 6,
    })
    // Reset frame reads the raw stage actionTime (18), not the variant advance (6).
    expect(result.footingChanges).toEqual([
      { atFrame: 25, exitFooting: "air", kind: "commit" },
      { atFrame: 28, exitFooting: "ground", kind: "reset" },
    ])
  })

  it("in-stage launch (commit <= advance) still carries [commit, reset] on the owner", () => {
    // The launch frame (5) falls within the advance (6) — the owner flips the
    // field on-field, but the air must still ride on the owner for a swap-back,
    // so the commit + window-end reset are emitted regardless of the advance.
    const resolved = makeResolvedStage({
      stage: { actionTime: 24, footing: { launch: 5 } },
    })
    const result = partitionStage({
      entry: makeEntry(1),
      resolved,
      stageStartFrame: 0,
      hits: [],
      variantKind: "swap",
      stageDuration: 6,
    })
    expect(result.footingChanges).toEqual([
      { atFrame: 5, exitFooting: "air", kind: "commit" },
      { atFrame: 24, exitFooting: "ground", kind: "reset" },
    ])
  })

  it("land past advance → [commit@(start+land)] with no reset", () => {
    const resolved = makeResolvedStage({
      stage: { actionTime: 12, footing: { land: 20 } },
    })
    const result = partitionStage({
      entry: makeEntry(1),
      resolved,
      stageStartFrame: 0,
      hits: [],
      variantKind: "swap",
      stageDuration: 6,
    })
    expect(result.footingChanges).toEqual([
      { atFrame: 20, exitFooting: "ground", kind: "commit" },
    ])
  })

  it("in-stage land (commit <= advance) still carries [commit] on the owner", () => {
    // Symmetric to the in-stage launch: a land that commits within the advance
    // still carries `ground` on the owner so a swap-back after a teammate went
    // airborne resumes the owner grounded. No reset (land ends grounded already).
    const resolved = makeResolvedStage({
      stage: { actionTime: 18, footing: { land: 4 } },
    })
    const result = partitionStage({
      entry: makeEntry(1),
      resolved,
      stageStartFrame: 0,
      hits: [],
      variantKind: "swap",
      stageDuration: 6,
    })
    expect(result.footingChanges).toEqual([
      { atFrame: 4, exitFooting: "ground", kind: "commit" },
    ])
  })

  it("no footingChanges for non-swap stages (even with {launch:N})", () => {
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
    expect(result.footingChanges).toEqual([])
  })
})
