import { describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { BuffEvent } from "#/types/simulation-log"
import { emptyStatTable } from "#/types/stat-table"
import {
  InstanceStore,
  matchesTrigger,
  type EngineEvent,
} from "./instance-store"

vi.mock("./catalog", () => ({
  getCharacterById: () => null,
}))

const def = (overrides: Partial<BuffDef> = {}): BuffDef => ({
  id: "b.test",
  name: "Test",
  trigger: { event: "skillCast", actor: "self" },
  target: { kind: "self" },
  effects: [],
  duration: { kind: "permanent" },
  ...overrides,
})

describe("InstanceStore — registry & candidate matching", () => {
  it("findCandidates returns sorted matches", () => {
    const s = new InstanceStore()
    const a = def({ id: "b.a" })
    const b = def({ id: "b.b" })
    s.setTriggerable(1, [b, a])
    const event: EngineEvent = {
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    }
    const result = s.findCandidates(event)
    expect(result.map((c) => c.def.id)).toEqual(["b.a", "b.b"])
  })

  it("findCandidates filters by skillType when specified", () => {
    const s = new InstanceStore()
    const onSkill = def({
      id: "b.skill",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillType: "Resonance Skill",
      },
    })
    s.setTriggerable(1, [onSkill])
    expect(
      s.findCandidates({
        kind: "skillCast",
        characterId: 1,
        skillType: "Basic Attack",
        frame: 0,
      }),
    ).toEqual([])
    expect(
      s
        .findCandidates({
          kind: "skillCast",
          characterId: 1,
          skillType: "Resonance Skill",
          frame: 0,
        })
        .map((c) => c.def.id),
    ).toEqual(["b.skill"])
  })

  it("findCandidates respects actor='any' on cross-character casts", () => {
    const s = new InstanceStore()
    const teamBuff = def({
      id: "b.any",
      trigger: { event: "skillCast", actor: "any" },
    })
    s.setTriggerable(2, [teamBuff])
    const result = s.findCandidates({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(result.map((c) => c.def.id)).toEqual(["b.any"])
  })
})

describe("InstanceStore — apply / refresh / replace", () => {
  it("first apply pushes a new instance and emits buffApplied", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({ duration: { kind: "frames", v: 60 } })
    s.applyBuff(d, 1, 1, 0, out)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: "buffApplied", buffId: "b.test" })
    expect(s.activeBuffIds(1)).toEqual(["b.test"])
  })

  it("re-apply with default policy refreshes (single instance)", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({ duration: { kind: "frames", v: 60 } })
    s.applyBuff(d, 1, 1, 0, out)
    s.applyBuff(d, 1, 1, 30, out)
    expect(s.activeBuffIds(1)).toEqual(["b.test"])
    expect(out[1].kind).toBe("buffRefreshed")
  })

  it("replace policy expires old and applies new", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({
      duration: { kind: "frames", v: 60 },
      stacking: { max: 1, onRetrigger: "replace" },
    })
    s.applyBuff(d, 1, 1, 0, out)
    s.applyBuff(d, 1, 1, 30, out)
    expect(out.map((e) => e.kind)).toEqual([
      "buffApplied",
      "buffExpired",
      "buffApplied",
    ])
  })
})

describe("InstanceStore — tickToFrame", () => {
  it("expires instances whose endTime <= frame", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({ duration: { kind: "frames", v: 60 } })
    s.applyBuff(d, 1, 1, 0, out)
    expect(s.tickToFrame(59).lifecycleEvents).toEqual([])
    expect(s.tickToFrame(60).lifecycleEvents).toHaveLength(1)
    expect(s.activeBuffIds(1)).toEqual([])
  })
})

describe("InstanceStore — pendingNextOnField", () => {
  it("queues and drains pending nextOnField buffs to the new on-field target", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({
      target: { kind: "nextOnField" },
      duration: { kind: "frames", v: 60 },
    })
    s.pushPendingNextOnField(d, 1, 0)
    expect(s.pendingNextOnFieldCount()).toBe(1)
    s.drainPendingNextOnField(2, 5, out)
    expect(s.pendingNextOnFieldCount()).toBe(0)
    expect(s.activeBuffIds(2)).toEqual(["b.test"])
  })
})

describe("InstanceStore — expireOnSourceSwapOut", () => {
  it("removes instances flagged expiresOnSourceSwapOut whose source matches", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const sticky = def({
      id: "b.sticky",
      duration: { kind: "frames", v: 600 },
      expiresOnSourceSwapOut: true,
    })
    s.applyBuff(sticky, 1, 1, 0, out)
    s.expireOnSourceSwapOut(1, 10, out)
    expect(s.activeBuffIds(1)).toEqual([])
  })

  it("keeps instances whose source does not match", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const sticky = def({
      id: "b.sticky",
      duration: { kind: "frames", v: 600 },
      expiresOnSourceSwapOut: true,
    })
    s.applyBuff(sticky, 1, 1, 0, out)
    s.expireOnSourceSwapOut(2, 10, out)
    expect(s.activeBuffIds(1)).toEqual(["b.sticky"])
  })
})

describe("InstanceStore — runConsumePhase", () => {
  it("decrements stacks and emits buffConsumed when the filter matches", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({
      duration: { kind: "frames", v: 600 },
      consumedBy: { event: "hitLanded", actor: "self" },
    })
    s.applyBuff(d, 1, 1, 0, out)
    out.length = 0
    const event: EngineEvent = {
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Basic",
      frame: 5,
    }
    s.runConsumePhase(event, out)
    expect(out.map((e) => e.kind)).toEqual(["buffConsumed"])
    expect(s.activeBuffIds(1)).toEqual([])
  })
})

describe("InstanceStore — findCrossedThresholds", () => {
  it("returns thresholds registered on triggers that the transition crosses", () => {
    const s = new InstanceStore()
    const t60 = def({
      id: "b.t60",
      trigger: {
        event: "resourceCrossed",
        resource: "energy",
        threshold: 60,
        direction: "up",
      },
    })
    const t100 = def({
      id: "b.t100",
      trigger: {
        event: "resourceCrossed",
        resource: "energy",
        threshold: 100,
        direction: "up",
      },
    })
    s.setTriggerable(1, [t60, t100])
    expect(
      s.findCrossedThresholds("energy", "up", 0, 100).sort((a, b) => a - b),
    ).toEqual([60, 100])
    expect(s.findCrossedThresholds("energy", "up", 0, 50)).toEqual([])
  })
})

describe("InstanceStore — resolveStats helpers", () => {
  it("cloneBaseStats returns an empty StatTable when no character or stats are set", () => {
    const s = new InstanceStore()
    expect(s.cloneBaseStats(1)).toEqual(emptyStatTable())
  })

  it("cloneBaseStats returns a clone of stored base stats", () => {
    const s = new InstanceStore()
    const stats = { ...emptyStatTable(), atkBase: 1234 }
    s.setBaseStats(1, stats)
    const out = s.cloneBaseStats(1)
    expect(out.atkBase).toBe(1234)
    out.atkBase = 0
    expect(s.cloneBaseStats(1).atkBase).toBe(1234)
  })

  it("getActiveTargeting filters and sorts by def.id", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    s.applyBuff(def({ id: "b.b" }), 1, 1, 0, out)
    s.applyBuff(def({ id: "b.a" }), 1, 1, 0, out)
    s.applyBuff(def({ id: "b.x", target: { kind: "self" } }), 2, 2, 0, out)
    expect(s.getActiveTargeting(1).map((i) => i.def.id)).toEqual(["b.a", "b.b"])
  })

  it("hasActiveOnTarget returns true when an instance with that buffId targets the given character", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    s.applyBuff(def({ id: "b.x" }), 1, 1, 0, out)
    expect(s.hasActiveOnTarget("b.x", 1)).toBe(true)
    expect(s.hasActiveOnTarget("b.x", 2)).toBe(false)
    expect(s.hasActiveOnTarget("b.y", 1)).toBe(false)
  })
})

describe("InstanceStore — resolveTargetIds", () => {
  it("returns source for self-target", () => {
    const s = new InstanceStore()
    expect(s.resolveTargetIds(def({ target: { kind: "self" } }), 7)).toEqual([
      7,
    ])
  })

  it("returns all populated slots for team-target", () => {
    const s = new InstanceStore()
    s.setSlots([1, -1, 3])
    expect(s.resolveTargetIds(def({ target: { kind: "team" } }), 1)).toEqual([
      1, 3,
    ])
  })

  it("returns empty for nextOnField (deferred to swap-in)", () => {
    const s = new InstanceStore()
    expect(
      s.resolveTargetIds(def({ target: { kind: "nextOnField" } }), 1),
    ).toEqual([])
  })
})

describe("matchesTrigger — synthetic source filtering", () => {
  it("default 'self' source rejects synthetic hits", () => {
    const trigger = { event: "hitLanded", actor: "self" } as const
    const event: EngineEvent = {
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Basic",
      frame: 0,
      synthetic: true,
    }
    expect(matchesTrigger(trigger, event, 1)).toBe(false)
  })

  it("source='synthetic' only matches synthetic hits", () => {
    const trigger = {
      event: "hitLanded",
      actor: "self",
      source: "synthetic",
    } as const
    const real: EngineEvent = {
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Basic",
      frame: 0,
    }
    const synth: EngineEvent = { ...real, synthetic: true }
    expect(matchesTrigger(trigger, real, 1)).toBe(false)
    expect(matchesTrigger(trigger, synth, 1)).toBe(true)
  })
})
