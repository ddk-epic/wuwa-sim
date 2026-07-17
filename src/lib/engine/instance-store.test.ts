// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import type { BuffDef, Trigger } from "#/types/buff"
import type { BuffEvent } from "#/types/simulation-log"
import { emptyStatTable } from "#/types/stat-table"
import { InstanceStore, matchesTrigger } from "./instance-store"
import type { EngineEvent } from "./instance-store"

vi.mock("../loadout/catalog", () => ({
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
      skillCategory: "Basic Attack",
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
        skillCategory: "Resonance Skill",
      },
    })
    s.setTriggerable(1, [onSkill])
    expect(
      s.findCandidates({
        kind: "skillCast",
        characterId: 1,
        skillCategory: "Basic Attack",
        frame: 0,
      }),
    ).toEqual([])
    expect(
      s
        .findCandidates({
          kind: "skillCast",
          characterId: 1,
          skillCategory: "Resonance Skill",
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
      skillCategory: "Basic Attack",
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
      skillCategory: "Basic Attack",
      dmgType: "Basic",
      frame: 5,
    }
    s.runConsumePhase(event, out)
    expect(out.map((e) => e.kind)).toEqual(["buffConsumed"])
    expect(s.activeBuffIds(1)).toEqual([])
  })
})

describe("InstanceStore — resolveStats helpers", () => {
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

  it("throws when called with nextOnField — must go through applyOrDefer", () => {
    const s = new InstanceStore()
    expect(() =>
      s.resolveTargetIds(def({ target: { kind: "nextOnField" } }), 1),
    ).toThrow("applyOrDefer")
  })

  describe("self wielder-id filter", () => {
    it("scalar characterId: lands for a listed wielder", () => {
      const s = new InstanceStore()
      expect(
        s.resolveTargetIds(
          def({ target: { kind: "self", characterId: 7 } }),
          7,
        ),
      ).toEqual([7])
    })

    it("scalar characterId: no-ops for an unlisted wielder", () => {
      const s = new InstanceStore()
      expect(
        s.resolveTargetIds(
          def({ target: { kind: "self", characterId: 7 } }),
          9,
        ),
      ).toEqual([])
    })

    it("array characterId: lands when source is in the list, no-ops otherwise", () => {
      const s = new InstanceStore()
      const d = def({ target: { kind: "self", characterId: [7, 8] } })
      expect(s.resolveTargetIds(d, 8)).toEqual([8])
      expect(s.resolveTargetIds(d, 9)).toEqual([])
    })
  })
})

describe("matchesTrigger — synthetic source filtering", () => {
  it("default 'self' source rejects synthetic hits", () => {
    const trigger: Trigger = { event: "hitLanded", actor: "self" }
    const event: EngineEvent = {
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Basic",
      frame: 0,
      synthetic: true,
    }
    expect(matchesTrigger(trigger, event, 1)).toBe(false)
  })

  it("source='synthetic' only matches synthetic hits", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      source: "synthetic",
    }
    const real: EngineEvent = {
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Basic",
      frame: 0,
    }
    const synth: EngineEvent = { ...real, synthetic: true }
    expect(matchesTrigger(trigger, real, 1)).toBe(false)
    expect(matchesTrigger(trigger, synth, 1)).toBe(true)
  })
})

describe("matchesTrigger — stage axes (stageId / skill / hitIndex)", () => {
  const BASE_STAGE =
    "char.encore.basic-attack.wooly-attack.stage-5::basic-attack"
  const baseEvent: EngineEvent = {
    kind: "hitLanded",
    characterId: 1,
    skillCategory: "Basic Attack",
    dmgType: "Damage",
    frame: 0,
    stageId: BASE_STAGE,
    skill: "wooly-attack",
    hitIndex: 3,
  }

  it("positive match: exact stageId matches regardless of hit index", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      stageId: BASE_STAGE,
    }
    expect(matchesTrigger(trigger, baseEvent, 1)).toBe(true)
  })

  it("positive match: stageId + matching hitIndex", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      stageId: BASE_STAGE,
      hitIndex: 3,
    }
    expect(matchesTrigger(trigger, baseEvent, 1)).toBe(true)
  })

  it("positive match: skill axis matches every stage of the skill", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      skill: "wooly-attack",
    }
    expect(matchesTrigger(trigger, baseEvent, 1)).toBe(true)
  })

  it("positive match: stageId array includes the event's stage", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      stageId: [
        BASE_STAGE,
        "char.encore.basic-attack.wooly-attack.heavy-attack::heavy-attack",
      ],
    }
    expect(matchesTrigger(trigger, baseEvent, 1)).toBe(true)
  })

  it("negative match: wrong stageId", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      stageId: "echo.impermanence-heron.tap::echo-skill",
    }
    expect(matchesTrigger(trigger, baseEvent, 1)).toBe(false)
  })

  it("negative match: wrong skill", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      skill: "cosmos-rave",
    }
    expect(matchesTrigger(trigger, baseEvent, 1)).toBe(false)
  })

  it("negative match: event has no stageId when trigger requires one", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      stageId: BASE_STAGE,
    }
    expect(
      matchesTrigger(trigger, { ...baseEvent, stageId: undefined }, 1),
    ).toBe(false)
  })

  it("negative match: trigger requires a different hit index", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      stageId: BASE_STAGE,
      hitIndex: 2,
    }
    expect(matchesTrigger(trigger, baseEvent, 1)).toBe(false)
  })

  it("combined dmgType + stageId all must match", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      dmgType: "Damage",
      stageId: BASE_STAGE,
    }
    expect(matchesTrigger(trigger, baseEvent, 1)).toBe(true)
    expect(matchesTrigger(trigger, { ...baseEvent, dmgType: "Other" }, 1)).toBe(
      false,
    )
  })
})

describe("matchesTrigger — sourceBuffId filter", () => {
  const baseEvent: EngineEvent = {
    kind: "hitLanded",
    characterId: 1,
    skillCategory: "Resonance Skill",
    dmgType: "Damage",
    synthetic: true,
    frame: 0,
  }

  it("single sourceBuffId: matches when event sourceBuffId equals trigger value", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      source: "synthetic",
      sourceBuff: "char.sanhua.ice-prism-burst",
    }
    expect(
      matchesTrigger(
        trigger,
        { ...baseEvent, sourceBuffId: "char.sanhua.ice-prism-burst" },
        1,
      ),
    ).toBe(true)
  })

  it("single sourceBuffId: does not match when event sourceBuffId differs", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      source: "synthetic",
      sourceBuff: "char.sanhua.ice-prism-burst",
    }
    expect(
      matchesTrigger(
        trigger,
        { ...baseEvent, sourceBuffId: "char.sanhua.glacier-burst" },
        1,
      ),
    ).toBe(false)
  })

  it("array sourceBuffId: matches when event sourceBuffId is one of the listed values", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      source: "synthetic",
      sourceBuff: ["char.sanhua.ice-prism-burst", "char.sanhua.glacier-burst"],
    }
    expect(
      matchesTrigger(
        trigger,
        { ...baseEvent, sourceBuffId: "char.sanhua.glacier-burst" },
        1,
      ),
    ).toBe(true)
  })

  it("array sourceBuffId: does not match when event sourceBuffId is not listed", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      source: "synthetic",
      sourceBuff: ["char.sanhua.ice-prism-burst", "char.sanhua.glacier-burst"],
    }
    expect(
      matchesTrigger(
        trigger,
        { ...baseEvent, sourceBuffId: "char.sanhua.ice-thorn-burst" },
        1,
      ),
    ).toBe(false)
  })
})

describe("matchesTrigger — targetHasStatus gate", () => {
  const baseEvent: EngineEvent = {
    kind: "hitLanded",
    characterId: 1,
    skillCategory: "Resonance Skill",
    dmgType: "Damage",
    frame: 0,
  }

  it("fires when stamped targetStatuses includes the type", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      targetHasStatus: "Aero Erosion",
    }
    expect(
      matchesTrigger(
        trigger,
        { ...baseEvent, targetStatuses: ["Aero Erosion"] },
        1,
      ),
    ).toBe(true)
  })

  it("does not fire when the status is absent from targetStatuses", () => {
    const trigger: Trigger = {
      event: "hitLanded",
      actor: "self",
      targetHasStatus: "Aero Erosion",
    }
    expect(
      matchesTrigger(
        trigger,
        { ...baseEvent, targetStatuses: ["Spectro Frazzle"] },
        1,
      ),
    ).toBe(false)
    // targetStatuses entirely absent also fails the gate.
    expect(matchesTrigger(trigger, baseEvent, 1)).toBe(false)
  })
})

describe("InstanceStore — instanceId identity", () => {
  it("two perSource instances on the same target from different sources get distinct ids", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({ perSource: true, duration: { kind: "frames", v: 60 } })
    s.applyBuff(d, 1, 5, 0, out)
    s.applyBuff(d, 2, 5, 0, out)
    const ids = s.allActive().map((i) => i.instanceId)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
    const applied = out.filter((e) => e.kind === "buffApplied")
    expect(applied.map((e) => e.instanceId)).toEqual(ids)
  })

  it("refresh emits the same instanceId as the original buffApplied", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({ duration: { kind: "frames", v: 60 } })
    s.applyBuff(d, 1, 1, 0, out)
    s.applyBuff(d, 1, 1, 30, out)
    expect(out[0].kind).toBe("buffApplied")
    expect(out[1].kind).toBe("buffRefreshed")
    expect(out[1].instanceId).toBe(out[0].instanceId)
  })

  it("addStackRefresh carries the original instanceId", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({
      duration: { kind: "frames", v: 60 },
      stacking: { max: 3, onRetrigger: "addStackRefresh" },
    })
    s.applyBuff(d, 1, 1, 0, out)
    s.applyBuff(d, 1, 1, 10, out)
    expect(out[1].kind).toBe("buffRefreshed")
    expect(out[1].instanceId).toBe(out[0].instanceId)
  })

  it("replace emits buffExpired with the old id and buffApplied with a new id", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({
      duration: { kind: "frames", v: 60 },
      stacking: { max: 1, onRetrigger: "replace" },
    })
    s.applyBuff(d, 1, 1, 0, out)
    s.applyBuff(d, 1, 1, 30, out)
    const [firstApplied, expired, secondApplied] = out
    expect(firstApplied.kind).toBe("buffApplied")
    expect(expired.kind).toBe("buffExpired")
    expect(secondApplied.kind).toBe("buffApplied")
    expect(expired.instanceId).toBe(firstApplied.instanceId)
    expect(secondApplied.instanceId).not.toBe(firstApplied.instanceId)
  })

  it("addStackIndependent carries the original instanceId", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({
      duration: { kind: "frames", v: 60 },
      stacking: { max: 3, onRetrigger: "addStackIndependent" },
    })
    s.applyBuff(d, 1, 1, 0, out)
    s.applyBuff(d, 1, 1, 10, out)
    expect(out[1].kind).toBe("buffStacksChanged")
    expect(out[1].instanceId).toBe(out[0].instanceId)
  })
})

describe("InstanceStore — addStackIndependent per-stack timers", () => {
  const indep = (max: number, frames: number): BuffDef =>
    def({
      duration: { kind: "frames", v: frames },
      stacking: { max, onRetrigger: "addStackIndependent" },
    })

  it("staggered mints expire one at a time in mint order", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = indep(3, 100)
    s.applyBuff(d, 1, 1, 0, out)
    s.applyBuff(d, 1, 1, 20, out)
    s.applyBuff(d, 1, 1, 40, out)
    expect(s.buffStacksOnTarget("b.test", 1)).toBe(3)

    s.tickToFrame(100)
    expect(s.buffStacksOnTarget("b.test", 1)).toBe(2)
    s.tickToFrame(120)
    expect(s.buffStacksOnTarget("b.test", 1)).toBe(1)
    s.tickToFrame(140)
    expect(s.buffStacksOnTarget("b.test", 1)).toBe(0)
    expect(s.allActive()).toHaveLength(0)
  })

  it("emits buffExpired once the last stack drains", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = indep(2, 50)
    s.applyBuff(d, 1, 1, 0, out)
    s.applyBuff(d, 1, 1, 10, out)
    const { lifecycleEvents } = s.tickToFrame(49)
    expect(lifecycleEvents).toHaveLength(0)
    const drain = s.tickToFrame(60)
    expect(drain.lifecycleEvents).toHaveLength(1)
    expect(drain.lifecycleEvents[0].kind).toBe("buffExpired")
  })

  it("emits buffStacksChanged rising on mint and falling on decay", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = indep(3, 100)
    s.applyBuff(d, 1, 1, 0, out)
    s.applyBuff(d, 1, 1, 20, out)
    const minted = out[1]
    expect(minted.kind).toBe("buffStacksChanged")
    expect(minted.stacks).toBe(2)

    const decay = s.tickToFrame(100)
    expect(decay.lifecycleEvents).toHaveLength(1)
    expect(decay.lifecycleEvents[0].kind).toBe("buffStacksChanged")
    expect(decay.lifecycleEvents[0].stacks).toBe(1)
  })

  it("draining at cap keeps exactly max, dropping the oldest", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = indep(2, 100)
    s.applyBuff(d, 1, 1, 0, out)
    s.applyBuff(d, 1, 1, 30, out)
    s.applyBuff(d, 1, 1, 60, out)
    expect(s.buffStacksOnTarget("b.test", 1)).toBe(2)

    s.tickToFrame(110)
    expect(s.buffStacksOnTarget("b.test", 1)).toBe(2)
    s.tickToFrame(130)
    expect(s.buffStacksOnTarget("b.test", 1)).toBe(1)
    s.tickToFrame(160)
    expect(s.buffStacksOnTarget("b.test", 1)).toBe(0)
  })
})

describe("InstanceStore — hidden buffs leave no log footprint", () => {
  const consumeTrigger: Trigger = { event: "skillCast", actor: "self" }

  it("applies and gates without emitting apply/expire/consume events", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({
      hidden: true,
      duration: { kind: "frames", v: 60 },
      consumedBy: consumeTrigger,
    })
    s.applyBuff(d, 1, 1, 0, out)
    expect(out).toHaveLength(0)
    // Effect/gating still live: the instance exists and is queryable.
    expect(s.hasActiveOnTarget("b.test", 1)).toBe(true)

    s.runConsumePhase(
      {
        kind: "skillCast",
        characterId: 1,
        skillCategory: "Basic Attack",
        frame: 5,
      },
      out,
    )
    expect(out).toHaveLength(0)
    expect(s.hasActiveOnTarget("b.test", 1)).toBe(false)
  })
})

describe("InstanceStore — clear", () => {
  it("clear() resets the id counter for deterministic ids per run", () => {
    const s = new InstanceStore()
    const out: BuffEvent[] = []
    const d = def({ duration: { kind: "frames", v: 60 } })
    s.applyBuff(d, 1, 1, 0, out)
    const firstId = s.allActive()[0].instanceId
    s.clear()
    s.applyBuff(d, 1, 1, 0, out)
    expect(s.allActive()[0].instanceId).toBe(firstId)
  })
})
