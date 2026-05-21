import { describe, it, expect } from "vitest"
import type { DamageEntry } from "#/types/character"
import type { TimelineEntry } from "#/types/timeline"
import type { ResolvedStage } from "./stage"
import {
  empty,
  onEntryArrival,
  scheduleStage,
  drainAll,
} from "./trailing-window"
import type { TrailingHit, TrailingWindowState } from "./trailing-window"

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

const stubResolved = {} as unknown as ResolvedStage

function makeHit(
  charId: number,
  actionFrame: number,
  hitFrame: number,
  hitIndex: number = 0,
  stageStartFrame: number = 0,
): TrailingHit {
  return {
    hit: makeDamageEntry(actionFrame),
    hitIndex,
    stageStartFrame,
    entry: makeEntry(charId),
    resolved: stubResolved,
    hitFrame,
  }
}

function makeState(entries: [number, TrailingHit[]][]): TrailingWindowState {
  return new Map(entries)
}

describe("trailing-window — empty", () => {
  it("returns an empty map", () => {
    const state = empty()
    expect(state).toBeInstanceOf(Map)
    expect(state.size).toBe(0)
  })
})

describe("trailing-window — onEntryArrival: no pending", () => {
  it("returns empty fireBeforeEntry and same state when no hits pending for characterId", () => {
    const state = empty()
    const result = onEntryArrival(state, {
      characterId: 1,
      skillType: "Basic Attack",
      frame: 10,
    })
    expect(result.fireBeforeEntry).toEqual([])
    expect(result.padFrames).toBe(0)
    expect(result.stateAfter).toBe(state)
  })
})

describe("trailing-window — onEntryArrival: no collision", () => {
  it("returns all hits in fireBeforeEntry when all hitFrames < incoming.frame", () => {
    const h1 = makeHit(1, 2, 5)
    const h2 = makeHit(1, 4, 8)
    const state = makeState([[1, [h1, h2]]])
    const result = onEntryArrival(state, {
      characterId: 1,
      skillType: "Basic Attack",
      frame: 10,
    })
    expect(result.fireBeforeEntry).toEqual([h1, h2])
    expect(result.padFrames).toBe(0)
    expect(result.stateAfter.has(1)).toBe(false)
  })
})

describe("trailing-window — onEntryArrival: cancel-capable drop", () => {
  it("silently drops hits with hitFrame >= frame; fires only earlier hits", () => {
    const h1 = makeHit(1, 1, 3) // before frame 10 → fire
    const h2 = makeHit(1, 5, 12) // collides
    const h3 = makeHit(1, 7, 15) // collides
    const state = makeState([[1, [h1, h2, h3]]])
    const result = onEntryArrival(state, {
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 10,
    })
    expect(result.fireBeforeEntry).toEqual([h1])
    expect(result.padFrames).toBe(0)
    expect(result.stateAfter.has(1)).toBe(false)
  })

  it("all cancel-capable skill types drop colliding hits", () => {
    for (const skillType of [
      "Resonance Skill",
      "Resonance Liberation",
      "Intro Skill",
      "Outro Skill",
      "Echo Skill",
    ] as const) {
      const h = makeHit(1, 5, 15)
      const state = makeState([[1, [h]]])
      const result = onEntryArrival(state, {
        characterId: 1,
        skillType,
        frame: 10,
      })
      expect(result.fireBeforeEntry).toEqual([])
      expect(result.padFrames).toBe(0)
    }
  })
})

describe("trailing-window — onEntryArrival: non-cancel-capable pad-extension", () => {
  it("returns all hits and padFrames = lastHit.hitFrame - frame", () => {
    const h1 = makeHit(1, 2, 5)
    const h2 = makeHit(1, 8, 18)
    const state = makeState([[1, [h1, h2]]])
    const result = onEntryArrival(state, {
      characterId: 1,
      skillType: "Basic Attack",
      frame: 10,
    })
    expect(result.fireBeforeEntry).toEqual([h1, h2])
    expect(result.padFrames).toBe(8) // 18 - 10
    expect(result.stateAfter.has(1)).toBe(false)
  })
})

describe("trailing-window — onEntryArrival: multi-character isolation", () => {
  it("pending for char A is unaffected by arrival of char B", () => {
    const h1 = makeHit(1, 2, 5)
    const state = makeState([[1, [h1]]])
    const result = onEntryArrival(state, {
      characterId: 2,
      skillType: "Basic Attack",
      frame: 10,
    })
    expect(result.fireBeforeEntry).toEqual([])
    expect(result.padFrames).toBe(0)
    expect(result.stateAfter.get(1)).toEqual([h1])
  })
})

describe("trailing-window — scheduleStage: swap partition cutoff", () => {
  it("hits with actionFrame > stageDuration become trailing; others are immediate", () => {
    const state = empty()
    const entry = makeEntry(1)
    const hits = [makeDamageEntry(2), makeDamageEntry(6), makeDamageEntry(9)]
    const result = scheduleStage(state, {
      entry,
      resolved: stubResolved,
      stageStartFrame: 0,
      hits,
      variantKind: "swap",
      stageDuration: 5,
    })
    expect(result.immediate).toHaveLength(1)
    expect(result.immediate[0].hit.actionFrame).toBe(2)
    const trailing = result.stateAfter.get(1)
    expect(trailing).toHaveLength(2)
    expect(trailing![0].hit.actionFrame).toBe(6)
    expect(trailing![1].hit.actionFrame).toBe(9)
  })

  it("when all hits within stageDuration, stateAfter is unchanged", () => {
    const state = empty()
    const entry = makeEntry(1)
    const hits = [makeDamageEntry(1), makeDamageEntry(3)]
    const result = scheduleStage(state, {
      entry,
      resolved: stubResolved,
      stageStartFrame: 0,
      hits,
      variantKind: "swap",
      stageDuration: 5,
    })
    expect(result.immediate).toHaveLength(2)
    expect(result.stateAfter).toBe(state)
  })
})

describe("trailing-window — scheduleStage: non-swap partition", () => {
  it("all hits go to immediate; stateAfter unchanged for non-swap variantKind", () => {
    const state = empty()
    const entry = makeEntry(1)
    const hits = [makeDamageEntry(2), makeDamageEntry(6)]
    const result = scheduleStage(state, {
      entry,
      resolved: stubResolved,
      stageStartFrame: 0,
      hits,
      variantKind: undefined,
      stageDuration: 5,
    })
    expect(result.immediate).toHaveLength(2)
    expect(result.stateAfter).toBe(state)
  })
})

describe("trailing-window — drainAll", () => {
  it("returns all hits across all characters", () => {
    const h1 = makeHit(1, 1, 10)
    const h2 = makeHit(1, 2, 20)
    const h3 = makeHit(2, 3, 30)
    const state = makeState([
      [1, [h1, h2]],
      [2, [h3]],
    ])
    const result = drainAll(state)
    expect(result).toHaveLength(3)
    expect(result).toContainEqual(h1)
    expect(result).toContainEqual(h2)
    expect(result).toContainEqual(h3)
  })

  it("returns empty array when state is empty", () => {
    expect(drainAll(empty())).toEqual([])
  })
})
