// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { WeaponData } from "#/types/weapon"
import type { EnrichedEcho } from "#/types/echo"
import type { EchoSet } from "#/types/echo-set"
import type { BuffDef } from "#/types/buff"
import { GLOBAL_TARGET_ID } from "#/types/buff"
import { BuffEngine } from "./buff-engine"
import {
  drainSynthetics,
  pendingNextOnFieldCount,
} from "./buff-engine.test-utils"
import {
  BASE_ATK_PCT,
  BASE_CR,
  baseChar,
  emptyLoadout,
  inactiveBuff,
  slotsOf,
} from "./buff-engine.test-fixtures"

let testCharacters: EnrichedCharacter[] = []
let testWeapons: WeaponData[] = []
let testEchoes: EnrichedEcho[] = []
let testEchoSets: EchoSet[] = []

vi.mock("../loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getWeaponById: (id: number) => testWeapons.find((w) => w.id === id) ?? null,
  getEchoById: (id: number) => testEchoes.find((e) => e.id === id) ?? null,
  getEchoSetById: (id: number) => testEchoSets.find((s) => s.id === id) ?? null,
}))

afterEach(() => {
  testCharacters = []
  testWeapons = []
  testEchoes = []
  testEchoSets = []
})

describe("BuffEngine — nextOnField deferred resolution (#57)", () => {
  it("materializes a nextOnField buff at the next swapIn", () => {
    const outro: BuffDef = {
      id: "char.a.outro",
      name: "Outro",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Outro Skill",
      },
      target: { kind: "nextOnField" },
      duration: { kind: "seconds", v: 14 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [outro] }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    // Establish on-field as 1
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    // Cast outro: trigger fires but nothing materializes yet.
    const outroFire = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 50,
    })
    expect(outroFire.lifecycleEvents).toEqual([])
    expect(pendingNextOnFieldCount(engine)).toBe(1)
    expect(engine.resolveStats(2).atkPct).toBeCloseTo(BASE_ATK_PCT)

    // Swap to character 2 — materialize on 2.
    const swap = engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillCategory: "Basic Attack",
      frame: 60,
    })
    const applied = swap.lifecycleEvents.find(
      (e) => e.kind === "buffApplied" && e.buffId === "char.a.outro",
    )
    expect(applied).toBeDefined()
    expect(applied?.targetCharacterId).toBe(2)
    expect(engine.resolveStats(2).atkPct).toBeCloseTo(0.3 + BASE_ATK_PCT)
  })

  it("queue is drained on swap-in: buff targets the incoming character, not the outro caster", () => {
    const outro: BuffDef = {
      id: "char.a.outro",
      name: "Outro",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Outro Skill",
      },
      target: { kind: "nextOnField" },
      duration: { kind: "frames", v: 60 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [outro] }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 10,
    })
    expect(pendingNextOnFieldCount(engine)).toBe(1)
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillCategory: "Basic Attack",
      frame: 20,
    })
    expect(pendingNextOnFieldCount(engine)).toBe(0)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)
    expect(engine.resolveStats(2).atkPct).toBeCloseTo(0.1 + BASE_ATK_PCT)
  })

  it("end-of-simulation with non-empty pending queue: buffs are silently dropped", () => {
    const outro: BuffDef = {
      id: "char.a.outro",
      name: "Outro",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Outro Skill",
      },
      target: { kind: "nextOnField" },
      duration: { kind: "frames", v: 60 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [outro] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, null, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 10,
    })
    expect(pendingNextOnFieldCount(engine)).toBe(1)
    // No swap-in follows — simulation ends; no error thrown
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)
  })
})

describe("BuffEngine — expiresOnSourceSwapOut (#57)", () => {
  it("removes instances whose source character swaps out", () => {
    const buff: BuffDef = {
      id: "char.a.tied-to-source",
      name: "Tied",
      trigger: { event: "skillCast", characterId: 1 },
      target: { kind: "global" },
      duration: { kind: "frames", v: 1000 },
      expiresOnSourceSwapOut: true,
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.15 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // 1 swaps in and casts (applies team buff)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.15 + BASE_ATK_PCT)
    expect(engine.resolveStats(2).atkPct).toBeCloseTo(0.15 + BASE_ATK_PCT)

    // Swap to 2 — source 1 swaps out, instances expire.
    const swap = engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillCategory: "Basic Attack",
      frame: 100,
    })
    const expired = swap.lifecycleEvents.filter(
      (e) => e.kind === "buffExpired" && e.buffId === "char.a.tied-to-source",
    )
    expect(expired.length).toBe(1)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)
    expect(engine.resolveStats(2).atkPct).toBeCloseTo(BASE_ATK_PCT)
  })
})

describe("BuffEngine — consumedBy (#61)", () => {
  const guaranteedCrit: BuffDef = {
    id: "char.next-basic-crit",
    name: "Next Basic Guaranteed Crit",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
    },
    target: { kind: "self" },
    duration: { kind: "frames", v: 600 },
    effects: [
      {
        kind: "stat",
        path: { stat: "critRate" },
        value: { kind: "const", v: 1 },
      },
    ],
    consumedBy: {
      event: "hitLanded",
      skillCategory: "Basic Attack",
      source: "self",
    },
  }

  it("removes the instance and emits buffConsumed when consumedBy matches", () => {
    testCharacters = [baseChar({ id: 1, buffs: [guaranteedCrit] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    expect(engine.resolveStats(1).critRate).toBeCloseTo(1 + BASE_CR)
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 30,
    })
    const consumed = result.lifecycleEvents.find(
      (e) => e.kind === "buffConsumed",
    )
    expect(consumed).toMatchObject({
      kind: "buffConsumed",
      buffId: "char.next-basic-crit",
      targetCharacterId: 1,
      stacks: 0,
      frame: 30,
    })
    expect(engine.resolveStats(1).critRate).toBeCloseTo(BASE_CR)
  })

  it("does not consume when the event does not match the filter", () => {
    testCharacters = [baseChar({ id: 1, buffs: [guaranteedCrit] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Heavy Attack",
      dmgType: "Fusion",
      frame: 30,
    })
    expect(result.lifecycleEvents.some((e) => e.kind === "buffConsumed")).toBe(
      false,
    )
    expect(engine.resolveStats(1).critRate).toBeCloseTo(1 + BASE_CR)
  })

  it("decrements stacks without removing while stacks remain >0", () => {
    const stackedConsumable: BuffDef = {
      id: "char.three-shot",
      name: "Three Shot",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Resonance Skill",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      stacking: { max: 3, onRetrigger: "addStackRefresh" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.1 },
        },
      ],
      consumedBy: {
        event: "hitLanded",
        skillCategory: "Basic Attack",
        source: "self",
      },
    }
    testCharacters = [baseChar({ id: 1, buffs: [stackedConsumable] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 1,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 2,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.3 + BASE_ATK_PCT)

    const r1 = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 10,
    })
    expect(r1.lifecycleEvents.some((e) => e.kind === "buffConsumed")).toBe(
      false,
    )
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.2 + BASE_ATK_PCT)

    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 20,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.1 + BASE_ATK_PCT)

    const r3 = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 30,
    })
    expect(r3.lifecycleEvents.some((e) => e.kind === "buffConsumed")).toBe(true)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)
  })

  it("runs after emitHit so the buff contributes to the triggering hit", () => {
    // A guaranteed-crit buff plus an emitHit synthetic. The synthetic hit
    // should resolve with the buff still active (consume runs after emitHit).
    const buff: BuffDef = {
      id: "char.crit-and-emit",
      name: "Crit + Emit",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "critRate" },
          value: { kind: "const", v: 1 },
        },
        {
          kind: "emitHit",
          damage: {
            type: "Basic Attack",
            dmgType: "Fusion",
            scalingStat: "atk",
            actionFrame: 0,
            value: 0.5,
            energy: 0,
            concerto: 0,
            toughness: 0,
            weakness: 0,
          },
          icdFrames: 0,
        },
      ],
      consumedBy: { event: "hitLanded", source: "self", actor: "any" },
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const r = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(drainSynthetics(engine, r.deferredEmits)).toHaveLength(1)
    expect(r.lifecycleEvents.some((e) => e.kind === "buffConsumed")).toBe(true)
  })
})

describe("BuffEngine — perSource (#61)", () => {
  const sharedBuff = (perSource: boolean): BuffDef => ({
    id: "team.shared",
    name: "Shared",
    trigger: {
      event: "skillCast",
      actor: "any",
      skillCategory: "Resonance Skill",
    },
    target: { kind: "global" },
    duration: { kind: "frames", v: 300 },
    perSource,
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 0.2 },
      },
    ],
  })

  it("default (perSource=false) refreshes a single instance from any source", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [sharedBuff(false)] }),
      baseChar({ id: 2, name: "B", buffs: [sharedBuff(false)] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillCategory: "Resonance Skill",
      frame: 1,
    })
    // Single instance, only +0.2 contribution.
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.2 + BASE_ATK_PCT)
    expect(engine.activeBuffIds(1)).toEqual(["team.shared"])
  })

  it("perSource=true produces parallel instances summing contributions", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [sharedBuff(true)] }),
      baseChar({ id: 2, name: "B", buffs: [sharedBuff(true)] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillCategory: "Resonance Skill",
      frame: 1,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.4 + BASE_ATK_PCT)
    expect(engine.activeBuffIds(1)).toEqual(["team.shared", "team.shared"])
  })
})

describe("BuffEngine — nonStackingGroup (#61)", () => {
  it("logs console.info when multiple buffs in the same group are co-active", () => {
    const a: BuffDef = {
      id: "buff.a",
      name: "A",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      condition: { kind: "onField" },
      nonStackingGroup: "atk-up",
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    }
    const b: BuffDef = {
      ...a,
      id: "buff.b",
      name: "B",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Basic Attack",
      },
      duration: { kind: "frames", v: 600 },
      condition: undefined,
    }
    testCharacters = [baseChar({ id: 1, buffs: [a, b] })]
    const engine = new BuffEngine()
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    try {
      engine.bootstrap({
        slots: slotsOf(1),
        loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
      })
      // Trigger b — a is already active from sim start, so this should warn.
      engine.onEvent({
        kind: "skillCast",
        characterId: 1,
        skillCategory: "Basic Attack",
        frame: 0,
      })
      expect(info).toHaveBeenCalled()
      const msg = String(info.mock.calls[0][0])
      expect(msg).toContain("atk-up")
      expect(msg).toContain("buff.a")
      expect(msg).toContain("buff.b")
    } finally {
      info.mockRestore()
    }
  })

  it("does not log when only one buff in the group is active", () => {
    const a: BuffDef = {
      id: "buff.a",
      name: "A",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Basic Attack",
      },
      target: { kind: "self" },
      duration: { kind: "frames", v: 600 },
      nonStackingGroup: "atk-up",
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [a] })]
    const engine = new BuffEngine()
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    try {
      engine.bootstrap({
        slots: slotsOf(1),
        loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
      })
      engine.onEvent({
        kind: "skillCast",
        characterId: 1,
        skillCategory: "Basic Attack",
        frame: 0,
      })
      expect(info).not.toHaveBeenCalled()
    } finally {
      info.mockRestore()
    }
  })
})

describe("BuffEngine — precondition gating for nextOnField stat buffs", () => {
  const windowBuff: BuffDef = {
    id: "test.window",
    name: "Window",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Echo Skill",
    },
    target: { kind: "self" },
    duration: { kind: "seconds", v: 15 },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 0 },
      },
    ],
  }

  const nextOnFieldWithCondition: BuffDef = {
    id: "test.conditional-nof",
    name: "Conditional NOF",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      precondition: { kind: "buffActive", buff: "window", on: "source" },
    },
    target: { kind: "nextOnField" },
    duration: { kind: "seconds", v: 15 },
    effects: [
      {
        kind: "stat",
        path: { stat: "allDmgBonus" },
        value: { kind: "const", v: 0.12 },
      },
    ],
  }

  it("does not enqueue nextOnField buff when precondition is false at trigger time", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [windowBuff, nextOnFieldWithCondition] }),
      baseChar({ id: 2, buffs: [] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    // Trigger outro without window buff active
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 0,
    })
    // Swap in char 2 — buff should NOT be applied
    engine.onEvent({ kind: "swapIn", characterId: 2, frame: 1 })

    expect(engine.activeBuffIds(2)).not.toContain("test.conditional-nof")
  })

  it("enqueues nextOnField buff when precondition is true at trigger time", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [windowBuff, nextOnFieldWithCondition] }),
      baseChar({ id: 2, buffs: [] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    // Activate window, then trigger outro
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Echo Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 1,
    })
    // Swap in char 2 — buff SHOULD be applied
    engine.onEvent({ kind: "swapIn", characterId: 2, frame: 2 })

    expect(engine.activeBuffIds(2)).toContain("test.conditional-nof")
  })
})

describe("BuffEngine — target collapses to source at trigger time", () => {
  it("nextOnField def with precondition.on=target evaluates against source, not nextOnField char", () => {
    const windowBuff: BuffDef = {
      id: "test.window",
      name: "Window",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Echo Skill",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 15 },
      effects: [],
    }
    // Precondition uses on: "target" — at trigger time this collapses to source (char 1)
    const nextOnFieldDef: BuffDef = {
      id: "test.nof-target-cond",
      name: "NOF target cond",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Outro Skill",
        precondition: { kind: "buffActive", buff: "window", on: "target" },
      },
      target: { kind: "nextOnField" },
      duration: { kind: "seconds", v: 15 },
      effects: [
        {
          kind: "stat",
          path: { stat: "allDmgBonus" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [
      baseChar({ id: 1, buffs: [windowBuff, nextOnFieldDef] }),
      baseChar({ id: 2, buffs: [] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    // Activate window on char 1 (source), then trigger outro
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Echo Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 1,
    })
    // Swap in char 2 — condition should pass because window is active on char 1 (source = target)
    engine.onEvent({ kind: "swapIn", characterId: 2, frame: 2 })

    expect(engine.activeBuffIds(2)).toContain("test.nof-target-cond")
  })

  it("nextOnField def with precondition.on=target does not pass when source lacks the buff", () => {
    const nextOnFieldDef: BuffDef = {
      id: "test.nof-target-absent",
      name: "NOF target absent",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Outro Skill",
        precondition: { kind: "buffActive", buff: "absent", on: "target" },
      },
      target: { kind: "nextOnField" },
      duration: { kind: "seconds", v: 15 },
      effects: [
        {
          kind: "stat",
          path: { stat: "allDmgBonus" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [
      baseChar({ id: 1, buffs: [nextOnFieldDef, inactiveBuff("test.absent")] }),
      baseChar({ id: 2, buffs: [] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 0,
    })
    engine.onEvent({ kind: "swapIn", characterId: 2, frame: 1 })

    expect(engine.activeBuffIds(2)).not.toContain("test.nof-target-absent")
  })
})

describe("BuffEngine — global target kind (#276)", () => {
  const globalBuff: BuffDef = {
    id: "test.global-amp",
    name: "Global AMP",
    trigger: { event: "skillCast", actor: "self", characterId: 1 },
    target: { kind: "global" },
    duration: { kind: "seconds", v: 10 },
    effects: [
      {
        kind: "stat",
        path: { stat: "allAmp" },
        value: { kind: "const", v: 0.15 },
      },
    ],
  }

  const setup = () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [globalBuff] }),
      baseChar({ id: 2 }),
      baseChar({ id: 3 }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, 3],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    return engine
  }

  it("produces a single buffApplied event with GLOBAL_TARGET_ID sentinel", () => {
    const engine = setup()
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(lifecycleEvents).toHaveLength(1)
    expect(lifecycleEvents[0]).toMatchObject({
      kind: "buffApplied",
      buffId: "test.global-amp",
      targetCharacterId: GLOBAL_TARGET_ID,
    })
  })

  it("all party members read the global instance via resolveStats", () => {
    const engine = setup()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).allAmp).toBeCloseTo(0.15)
    expect(engine.resolveStats(2).allAmp).toBeCloseTo(0.15)
    expect(engine.resolveStats(3).allAmp).toBeCloseTo(0.15)
  })

  it("all party members see the buff in activeBuffIds", () => {
    const engine = setup()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(engine.activeBuffIds(1)).toContain("test.global-amp")
    expect(engine.activeBuffIds(2)).toContain("test.global-amp")
    expect(engine.activeBuffIds(3)).toContain("test.global-amp")
  })

  it("re-trigger produces buffRefreshed, not a second instance", () => {
    const engine = setup()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 60,
    })
    expect(lifecycleEvents).toHaveLength(1)
    expect(lifecycleEvents[0].kind).toBe("buffRefreshed")
    // Only one instance in the store (all characters still read the same one)
    expect(
      engine.activeBuffIds(1).filter((id) => id === "test.global-amp"),
    ).toHaveLength(1)
    expect(
      engine.activeBuffIds(2).filter((id) => id === "test.global-amp"),
    ).toHaveLength(1)
  })

  it("expiry removes the buff for all party members", () => {
    const FPS = 60
    const engine = setup()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    engine.tickToFrame(10 * FPS + 1)
    expect(engine.activeBuffIds(1)).not.toContain("test.global-amp")
    expect(engine.activeBuffIds(2)).not.toContain("test.global-amp")
    expect(engine.activeBuffIds(3)).not.toContain("test.global-amp")
    expect(engine.resolveStats(1).allAmp).toBeCloseTo(0)
    expect(engine.resolveStats(2).allAmp).toBeCloseTo(0)
    expect(engine.resolveStats(3).allAmp).toBeCloseTo(0)
  })

  it("expiresOnSourceSwapOut removes the global instance when source swaps out", () => {
    const swapOutBuff: BuffDef = {
      ...globalBuff,
      id: "test.global-swapout",
      expiresOnSourceSwapOut: true,
    }
    testCharacters = [
      baseChar({ id: 1, buffs: [swapOutBuff] }),
      baseChar({ id: 2 }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // Apply the buff from char 1
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(engine.activeBuffIds(2)).toContain("test.global-swapout")
    // Swap to char 2 → char 1 swaps out → buff expires
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillCategory: "Basic Attack",
      frame: 60,
    })
    expect(engine.activeBuffIds(1)).not.toContain("test.global-swapout")
    expect(engine.activeBuffIds(2)).not.toContain("test.global-swapout")
  })
})

describe("BuffEngine — trigger precondition", () => {
  const window: BuffDef = {
    id: "test.window",
    name: "Window",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Echo Skill",
    },
    target: { kind: "self" },
    duration: { kind: "seconds", v: 15 },
    effects: [],
  }

  const gated: BuffDef = {
    id: "test.gated",
    name: "Gated",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      precondition: { kind: "buffActive", buff: "window", on: "source" },
    },
    target: { kind: "self" },
    duration: { kind: "seconds", v: 10 },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 0.2 },
      },
    ],
  }

  const setup = (buffs: BuffDef[]) => {
    testCharacters = [baseChar({ id: 1, buffs })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    return engine
  }

  it("mints nothing when the precondition is false at fire time", () => {
    const engine = setup([window, gated])
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(lifecycleEvents).toHaveLength(0)
    expect(engine.activeBuffIds(1)).not.toContain("test.gated")
  })

  it("mints when the precondition holds at fire time", () => {
    const engine = setup([window, gated])
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Echo Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 1,
    })
    expect(engine.activeBuffIds(1)).toContain("test.gated")
  })

  it("a precondition-gated fire does not consume the cooldown", () => {
    const gatedWithCd: BuffDef = { ...gated, cooldown: 10 }
    const engine = setup([window, gatedWithCd])

    // Fire while gated out — must not stamp the cooldown.
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Echo Skill",
      frame: 30,
    })
    // Within the 10s cooldown window of the gated-out fire; still applies.
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 60,
    })
    expect(engine.activeBuffIds(1)).toContain("test.gated")
  })
})
