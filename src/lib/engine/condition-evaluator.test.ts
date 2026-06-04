import { describe, it, expect, vi } from "vitest"
import type { BuffInstance, Condition } from "#/types/buff"
import { ConditionEvaluator } from "./condition-evaluator"
import type { ConditionWorld } from "./condition-evaluator"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorld(overrides: Partial<ConditionWorld> = {}): ConditionWorld {
  return {
    hasActiveBuff: vi.fn(),
    isOnField: vi.fn(),
    getResourceValue: vi.fn(),
    mutationVersions: vi.fn(() => ({ store: 0, resources: 0, onField: 0 })),
    ...overrides,
  }
}

function makeBuffInstance(
  id: string,
  sourceId: number,
  targetId: number,
): BuffInstance {
  return {
    def: { id, name: id, trigger: { event: "simStart" }, effects: [] },
    sourceCharacterId: sourceId,
    targetCharacterId: targetId,
    endTime: 0,
    stacks: 1,
    appliedFrame: 0,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ConditionEvaluator", () => {
  describe("evaluateUncached – kind switch coverage", () => {
    it("buffActive with on=target", () => {
      const world = makeWorld({
        hasActiveBuff: vi.fn((buffId: string, charId: number) => {
          return buffId === "buff1" && charId === 2
        }),
      })
      const evaluator = new ConditionEvaluator(world)
      const cond: Condition = {
        kind: "buffActive",
        buffId: "buff1",
        on: "target",
      }
      const subject = { sourceCharacterId: 1, targetCharacterId: 2 }
      expect(evaluator.evaluateUncached(cond, subject)).toBe(true)
    })

    it("buffActive with on=source", () => {
      const world = makeWorld({
        hasActiveBuff: vi.fn((buffId: string, charId: number) => {
          return buffId === "buff2" && charId === 1
        }),
      })
      const evaluator = new ConditionEvaluator(world)
      const cond: Condition = {
        kind: "buffActive",
        buffId: "buff2",
        on: "source",
      }
      const subject = { sourceCharacterId: 1, targetCharacterId: 2 }
      expect(evaluator.evaluateUncached(cond, subject)).toBe(true)
    })

    it("buffActive negate inverts presence (ADR-0033)", () => {
      const present = makeWorld({ hasActiveBuff: vi.fn(() => true) })
      const absent = makeWorld({ hasActiveBuff: vi.fn(() => false) })
      const cond: Condition = {
        kind: "buffActive",
        buffId: "budding",
        on: "source",
        negate: true,
      }
      const subject = { sourceCharacterId: 1, targetCharacterId: 2 }
      // Buff present → negated condition false; buff absent → true.
      expect(
        new ConditionEvaluator(present).evaluateUncached(cond, subject),
      ).toBe(false)
      expect(
        new ConditionEvaluator(absent).evaluateUncached(cond, subject),
      ).toBe(true)
    })

    it("onField", () => {
      const world = makeWorld({
        isOnField: vi.fn((charId: number) => charId === 2),
      })
      const evaluator = new ConditionEvaluator(world)
      const cond: Condition = { kind: "onField" }
      const subject = { sourceCharacterId: 1, targetCharacterId: 2 }
      expect(evaluator.evaluateUncached(cond, subject)).toBe(true)
    })

    it("actorIsOnField", () => {
      const world = makeWorld({
        isOnField: vi.fn((charId: number) => charId === 1),
      })
      const evaluator = new ConditionEvaluator(world)
      const cond: Condition = { kind: "actorIsOnField" }
      const subject = { sourceCharacterId: 1, targetCharacterId: 2 }
      expect(evaluator.evaluateUncached(cond, subject)).toBe(true)
    })

    it("actorIsOffField", () => {
      const world = makeWorld({
        isOnField: vi.fn((charId: number) => charId !== 1),
      })
      const evaluator = new ConditionEvaluator(world)
      const cond: Condition = { kind: "actorIsOffField" }
      const subject = { sourceCharacterId: 1, targetCharacterId: 2 }
      expect(evaluator.evaluateUncached(cond, subject)).toBe(true)
    })

    it("resourceAtLeast with on=target", () => {
      const world = makeWorld({
        getResourceValue: vi.fn((charId: number, resource: string) => {
          return charId === 2 && resource === "energy" ? 500 : 0
        }),
      })
      const evaluator = new ConditionEvaluator(world)
      const cond: Condition = {
        kind: "resourceAtLeast",
        resource: "energy",
        n: 100,
        on: "target",
      }
      const subject = { sourceCharacterId: 1, targetCharacterId: 2 }
      expect(evaluator.evaluateUncached(cond, subject)).toBe(true)
    })

    it("resourceAtLeast with on=source", () => {
      const world = makeWorld({
        getResourceValue: vi.fn((charId: number, resource: string) => {
          return charId === 1 && resource === "energy" ? 200 : 0
        }),
      })
      const evaluator = new ConditionEvaluator(world)
      const cond: Condition = {
        kind: "resourceAtLeast",
        resource: "energy",
        n: 150,
        on: "source",
      }
      const subject = { sourceCharacterId: 1, targetCharacterId: 2 }
      expect(evaluator.evaluateUncached(cond, subject)).toBe(true)
    })
  })

  describe("caching", () => {
    it("repeated identical calls return cached result (evalCount unchanged)", () => {
      const versions = { store: 0, resources: 0, onField: 0 }
      const world = makeWorld({
        mutationVersions: vi.fn(() => versions),
        isOnField: vi.fn(() => true),
      })
      const evaluator = new ConditionEvaluator(world)

      const cond: Condition = { kind: "onField" }
      const inst = makeBuffInstance("buff1", 1, 2)
      const actingId = 3

      // First call – should evaluate
      const r1 = evaluator.evaluateCached(cond, inst, actingId)
      expect(r1).toBe(true)
      expect(evaluator.evalCountForTest()).toBe(1)

      // Second call – cache hit
      const r2 = evaluator.evaluateCached(cond, inst, actingId)
      expect(r2).toBe(true)
      expect(evaluator.evalCountForTest()).toBe(1)

      // Third call – cache hit
      const r3 = evaluator.evaluateCached(cond, inst, actingId)
      expect(r3).toBe(true)
      expect(evaluator.evalCountForTest()).toBe(1)
    })

    it("cache invalidates when store version changes", () => {
      let versions = { store: 0, resources: 0, onField: 0 }
      const world = makeWorld({
        mutationVersions: vi.fn(() => versions),
        isOnField: vi.fn(() => true),
      })
      const evaluator = new ConditionEvaluator(world)

      const cond: Condition = { kind: "onField" }
      const inst = makeBuffInstance("buff1", 1, 2)
      const actingId = 3

      evaluator.evaluateCached(cond, inst, actingId)
      expect(evaluator.evalCountForTest()).toBe(1)

      // Change store version
      versions = { store: 1, resources: 0, onField: 0 }
      evaluator.evaluateCached(cond, inst, actingId)
      expect(evaluator.evalCountForTest()).toBe(2)
    })

    it("cache invalidates when resources version changes", () => {
      let versions = { store: 0, resources: 0, onField: 0 }
      const world = makeWorld({
        mutationVersions: vi.fn(() => versions),
        isOnField: vi.fn(() => true),
      })
      const evaluator = new ConditionEvaluator(world)

      const cond: Condition = { kind: "onField" }
      const inst = makeBuffInstance("buff1", 1, 2)
      const actingId = 3

      evaluator.evaluateCached(cond, inst, actingId)
      expect(evaluator.evalCountForTest()).toBe(1)

      versions = { store: 0, resources: 1, onField: 0 }
      evaluator.evaluateCached(cond, inst, actingId)
      expect(evaluator.evalCountForTest()).toBe(2)
    })

    it("cache invalidates when onField version changes", () => {
      let versions = { store: 0, resources: 0, onField: 0 }
      const world = makeWorld({
        mutationVersions: vi.fn(() => versions),
        isOnField: vi.fn(() => true),
      })
      const evaluator = new ConditionEvaluator(world)

      const cond: Condition = { kind: "onField" }
      const inst = makeBuffInstance("buff1", 1, 2)
      const actingId = 3

      evaluator.evaluateCached(cond, inst, actingId)
      expect(evaluator.evalCountForTest()).toBe(1)

      versions = { store: 0, resources: 0, onField: 1 }
      evaluator.evaluateCached(cond, inst, actingId)
      expect(evaluator.evalCountForTest()).toBe(2)
    })

    it("cache key isolation across (buffId, sourceId, targetId, actingId)", () => {
      const versions = { store: 0, resources: 0, onField: 0 }
      const isOnFieldMock = vi.fn().mockReturnValue(true)
      const world = makeWorld({
        mutationVersions: vi.fn(() => versions),
        isOnField: isOnFieldMock,
      })
      const evaluator = new ConditionEvaluator(world)

      const cond: Condition = { kind: "onField" }

      // First call: buff1, source1, target2, acting3
      evaluator.evaluateCached(cond, makeBuffInstance("buff1", 1, 2), 3)
      expect(evaluator.evalCountForTest()).toBe(1)

      // Same key -> cache hit
      evaluator.evaluateCached(cond, makeBuffInstance("buff1", 1, 2), 3)
      expect(evaluator.evalCountForTest()).toBe(1)

      // Different buffId
      evaluator.evaluateCached(cond, makeBuffInstance("buff2", 1, 2), 3)
      expect(evaluator.evalCountForTest()).toBe(2)

      // Different sourceId
      evaluator.evaluateCached(cond, makeBuffInstance("buff1", 2, 2), 3)
      expect(evaluator.evalCountForTest()).toBe(3)

      // Different targetId
      evaluator.evaluateCached(cond, makeBuffInstance("buff1", 1, 3), 3)
      expect(evaluator.evalCountForTest()).toBe(4)

      // Different actingCharacterId
      evaluator.evaluateCached(cond, makeBuffInstance("buff1", 1, 2), 99)
      expect(evaluator.evalCountForTest()).toBe(5)
    })
  })
})
