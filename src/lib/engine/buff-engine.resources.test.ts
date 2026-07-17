// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { WeaponData } from "#/types/weapon"
import type { EnrichedEcho } from "#/types/echo"
import type { EchoSet } from "#/types/echo-set"
import type { BuffDef } from "#/types/buff"
import { BuffEngine } from "./buff-engine"
import { drainSynthetics } from "./buff-engine.test-utils"
import {
  BASE_ATK_PCT,
  BASE_ER,
  baseChar,
  emptyLoadout,
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

describe("BuffEngine — resource state", () => {
  it("resourceAtLeast condition gates contribution", () => {
    const buff: BuffDef = {
      id: "char.high-energy",
      name: "High Energy",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      condition: {
        kind: "resourceAtLeast",
        resource: "energy",
        n: 100,
        on: "target",
      },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.25 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 100,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.25 + BASE_ATK_PCT)
  })

  it("resourceCrossed trigger fires once when the threshold is crossed upward", () => {
    const onConcerto100: BuffDef = {
      id: "char.concerto-ready",
      name: "Concerto Ready",
      trigger: {
        event: "resourceCrossed",
        resource: "concerto",
        threshold: 100,
        direction: "up",
      },
      target: { kind: "self" },
      duration: { kind: "frames", v: 1000 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [onConcerto100] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // Below threshold — no fire.
    const a = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 50,
    })
    expect(
      a.lifecycleEvents.find((e) => e.buffId === "char.concerto-ready"),
    ).toBeUndefined()
    // Crosses 100 — fires once.
    const b = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 10,
      concerto: 60,
    })
    const applied = b.lifecycleEvents.filter(
      (e) => e.buffId === "char.concerto-ready" && e.kind === "buffApplied",
    )
    expect(applied).toHaveLength(1)
    // Further upward gain does not fire again (would need to cross again).
    const c = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 20,
      concerto: 10,
    })
    const fired = c.lifecycleEvents.filter(
      (e) => e.buffId === "char.concerto-ready" && e.kind === "buffApplied",
    )
    expect(fired).toHaveLength(0)
  })

  it("raises an insufficientEnergy diagnostic when Liberation casts below cost but still dispatches, and zeroes energy", () => {
    testCharacters = [baseChar({ id: 1, name: "Test Character" })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Liberation",
      frame: 0,
    })
    expect(result.diagnostics).toHaveLength(1)
    const d = result.diagnostics[0]
    if (d.kind !== "insufficientEnergy") throw new Error("unreachable")
    expect(d.actor).toBe("Test Character")
    expect(d.energy).toBe(0)
    expect(engine.getResource(1).energy).toBe(0)
  })

  it("Liberation with energy >= cost zeroes energy with no diagnostic", () => {
    testCharacters = [baseChar({ id: 1 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 100,
    })
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Liberation",
      frame: 1,
      resonanceCost: 100,
    })
    expect(result.diagnostics).toHaveLength(0)
    expect(engine.getResource(1).energy).toBe(0)
  })

  it("Liberation with energy > resonanceCost zeroes energy (overflow forfeited)", () => {
    testCharacters = [baseChar({ id: 1 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 200,
    })
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Liberation",
      frame: 1,
      resonanceCost: 100,
    })
    expect(result.diagnostics).toHaveLength(0)
    expect(engine.getResource(1).energy).toBe(0)
  })

  it("Outro Skill cast drains the caster's concerto to exactly 0", () => {
    testCharacters = [baseChar({ id: 1 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 100,
    })
    expect(engine.getResource(1).concerto).toBe(100)
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 1,
    })
    expect(result.diagnostics).toHaveLength(0)
    expect(engine.getResource(1).concerto).toBe(0)
  })

  it("Outro overcap is wasted: concerto 130 → 0 (not 30)", () => {
    testCharacters = [baseChar({ id: 1 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 130,
    })
    expect(engine.getResource(1).concerto).toBe(130)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 1,
    })
    expect(engine.getResource(1).concerto).toBe(0)
  })

  it("Outro cast with concerto < 100 raises a diagnostic and still drains to 0", () => {
    testCharacters = [baseChar({ id: 1, name: "Test Character" })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 50,
    })
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 1,
    })
    expect(result.diagnostics).toHaveLength(1)
    const d = result.diagnostics[0]
    if (d.kind !== "insufficientOutroConcerto") throw new Error("unreachable")
    expect(d.actor).toBe("Test Character")
    expect(d.concerto).toBe(50)
    expect(engine.getResource(1).concerto).toBe(0)
  })

  it("cast below requiresConcerto raises insufficientConcerto, still spends, still dispatches", () => {
    testCharacters = [baseChar({ id: 1, name: "Test Character" })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 30,
    })
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 1,
      requiresConcerto: 100,
      concerto: -70,
    })
    expect(result.diagnostics).toHaveLength(1)
    const d = result.diagnostics[0]
    if (d.kind !== "insufficientConcerto") throw new Error("unreachable")
    expect(d.actor).toBe("Test Character")
    expect(d.concerto).toBe(30)
    expect(d.required).toBe(100)
    // Spend still applies, floored at 0; no full drain.
    expect(engine.getResource(1).concerto).toBe(0)
  })

  it("Outro drain fires resourceCrossed down for crossed thresholds", () => {
    // Buff fires a synthetic hit when concerto crosses 50 downward.
    // The drain clamps the overbank to the 100 cap first, so the crossing runs
    // over the real bar (100 → 0), never the discarded surplus above the cap.
    const onConcertoDrop: BuffDef = {
      id: "char.emit-on-concerto-down",
      name: "Emit on Concerto Down",
      trigger: {
        event: "resourceCrossed",
        resource: "concerto",
        threshold: 50,
        direction: "down",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
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
    }
    testCharacters = [baseChar({ id: 1, buffs: [onConcertoDrop] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 130,
    })
    const { deferredEmits } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 1,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    expect(synthetics[0]).toMatchObject({
      kind: "hit",
      synthetic: true,
      sourceBuffId: "char.emit-on-concerto-down",
      characterId: 1,
    })
  })

  // A buff that emits a synthetic hit whenever concerto is consumed by self.
  const emitOnConcertoConsumed: BuffDef = {
    id: "char.emit-on-concerto-consumed",
    name: "Emit on Concerto Consumed",
    trigger: { event: "resourceConsumed", resource: "concerto", actor: "self" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [
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
  }

  it("resourceConsumed fires on a partial op:sub spend gated by resourceAtLeast", () => {
    // On skillCast, spend 30 concerto when the caster has at least 30.
    const spendConcerto: BuffDef = {
      id: "char.spend-concerto",
      name: "Spend Concerto",
      trigger: { event: "skillCast", characterId: 1 },
      condition: {
        kind: "resourceAtLeast",
        resource: "concerto",
        n: 30,
        on: "source",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "resource",
          resource: "concerto",
          op: "sub",
          value: { kind: "const", v: 30 },
        },
      ],
    }
    testCharacters = [
      baseChar({ id: 1, buffs: [spendConcerto, emitOnConcertoConsumed] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 100,
    })
    const { deferredEmits } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Echo Skill",
      frame: 1,
    })
    expect(engine.getResource(1).concerto).toBe(70)
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    expect(synthetics[0]).toMatchObject({
      synthetic: true,
      sourceBuffId: "char.emit-on-concerto-consumed",
      characterId: 1,
    })
  })

  it("an overbanked op:sub honors the nominal cap and reports the cost, not the ledger drop", () => {
    const spendConcerto: BuffDef = {
      id: "char.spend-concerto",
      name: "Spend Concerto",
      trigger: { event: "skillCast", characterId: 1 },
      condition: {
        kind: "resourceAtLeast",
        resource: "concerto",
        n: 70,
        on: "source",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "resource",
          resource: "concerto",
          op: "sub",
          value: { kind: "const", v: 70 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [spendConcerto] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 180,
    })
    const dispatched: { kind: string; resource?: string; amount?: number }[] =
      []
    type Dispatcher = { dispatchEvent: (...a: unknown[]) => unknown }
    const internals = engine as unknown as Dispatcher
    const original = internals.dispatchEvent.bind(engine)
    vi.spyOn(internals, "dispatchEvent").mockImplementation((...args) => {
      dispatched.push(args[0] as { kind: string })
      return original(...args)
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Echo Skill",
      frame: 1,
    })
    // 180 clamps to the nominal 100 before the 70 draw — 30 left, not 110.
    expect(engine.getResource(1).concerto).toBe(30)
    const consumed = dispatched.filter((e) => e.kind === "resourceConsumed")
    expect(consumed).toContainEqual(
      expect.objectContaining({ resource: "concerto", amount: 70 }),
    )
  })

  it("resourceConsumed fires on the engine-internal Outro drain", () => {
    testCharacters = [baseChar({ id: 1, buffs: [emitOnConcertoConsumed] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 130,
    })
    const { deferredEmits } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 1,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    expect(synthetics[0]).toMatchObject({
      sourceBuffId: "char.emit-on-concerto-consumed",
    })
  })

  it("resourceConsumed does NOT fire on concerto accrual (upward delta)", () => {
    testCharacters = [baseChar({ id: 1, buffs: [emitOnConcertoConsumed] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 50,
    })
    expect(drainSynthetics(engine, deferredEmits)).toHaveLength(0)
  })

  it("resourceCrossed dispatched through main pipeline: own resource Effect crossing a threshold fires another buff with emitHit", () => {
    // Buff A: on skillCast, adds 100 concerto to self via a resource Effect.
    // Buff B: on concerto crossing 100 upward, emits a synthetic hit.
    const giveConcerto: BuffDef = {
      id: "char.give-concerto",
      name: "Give Concerto",
      trigger: { event: "skillCast", characterId: 1 },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "resource",
          resource: "concerto",
          op: "add",
          value: { kind: "const", v: 100 },
        },
      ],
    }
    const onConcerto100Emit: BuffDef = {
      id: "char.emit-on-concerto",
      name: "Emit on Concerto",
      trigger: {
        event: "resourceCrossed",
        resource: "concerto",
        threshold: 100,
        direction: "up",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
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
    }
    testCharacters = [
      baseChar({ id: 1, buffs: [giveConcerto, onConcerto100Emit] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { deferredEmits } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    expect(synthetics[0]).toMatchObject({
      kind: "hit",
      synthetic: true,
      sourceBuffId: "char.emit-on-concerto",
      characterId: 1,
    })
  })

  it("resourceCrossed-triggered emitHit chains into hitLanded triggers respecting ICD and depth cap", () => {
    // Each chained hit grants 1 concerto, crossing the threshold each iteration.
    // This walks both the resourceCrossed and hitLanded(synthetic) trigger paths.
    const giveConcerto: BuffDef = {
      id: "char.give-concerto",
      name: "Give Concerto",
      trigger: { event: "skillCast", characterId: 1 },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "resource",
          resource: "concerto",
          op: "add",
          value: { kind: "const", v: 100 },
        },
      ],
    }
    // Triggers on synthetic hits too. Re-emits, which itself produces a synthetic
    // hitLanded that this same trigger catches → chain. Capped by depth.
    const chainer: BuffDef = {
      id: "char.chainer",
      name: "Chainer",
      trigger: {
        event: "resourceCrossed",
        resource: "concerto",
        threshold: 100,
        direction: "up",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: {
            type: "Basic Attack",
            dmgType: "Fusion",
            scalingStat: "atk",
            actionFrame: 0,
            value: 0.1,
            energy: 0,
            concerto: 0,
            toughness: 0,
            weakness: 0,
          },
          icdFrames: 0,
        },
      ],
    }
    const synthChain: BuffDef = {
      id: "char.synth-chain",
      name: "Synth Chain",
      trigger: { event: "hitLanded", characterId: 1, source: "synthetic" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: {
            type: "Basic Attack",
            dmgType: "Fusion",
            scalingStat: "atk",
            actionFrame: 0,
            value: 0.1,
            energy: 0,
            concerto: 0,
            toughness: 0,
            weakness: 0,
          },
          icdFrames: 0,
        },
      ],
    }
    testCharacters = [
      baseChar({ id: 1, buffs: [giveConcerto, chainer, synthChain] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { deferredEmits } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    // resourceCrossed fires chainer (synthetic #1, depth 1). That synthetic
    // hitLanded fires synthChain (synthetic #2, depth 2). And so on, capped
    // at depth 8 — the whole chain resolves when the top-level decision drains.
    expect(drainSynthetics(engine, deferredEmits).length).toBeGreaterThan(1)
    expect(warn).toHaveBeenCalled()
    expect(warn.mock.calls[0][0]).toContain("emitHit chain depth exceeded")
    warn.mockRestore()
  })
})

describe("BuffEngine — per-hit energy sharing", () => {
  it("actor keeps 100% of energy; each teammate gets 50% of post-ER gain independently", () => {
    testCharacters = [
      baseChar({ id: 1 }),
      baseChar({ id: 2 }),
      baseChar({ id: 3 }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, 3],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 10,
    })
    expect(engine.getResource(1).energy).toBeCloseTo(10 * (1 + BASE_ER))
    expect(engine.getResource(2).energy).toBeCloseTo(10 * 0.5 * (1 + BASE_ER))
    expect(engine.getResource(3).energy).toBeCloseTo(10 * 0.5 * (1 + BASE_ER))
  })

  it("synthetic hits do not trigger energy sharing", () => {
    testCharacters = [baseChar({ id: 1 }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 10,
      synthetic: true,
    })
    expect(engine.getResource(1).energy).toBeCloseTo(10 * (1 + BASE_ER))
    expect(engine.getResource(2).energy).toBe(0)
  })
})

describe("BuffEngine — forte resource channel", () => {
  it("accumulates forte from hitLanded events, unscaled when forteRechargePct = 0", () => {
    testCharacters = [baseChar({ id: 1, forteCap: 100 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      forte: 20,
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 10,
      forte: 10,
    })
    expect(engine.getResource(1).forte).toBeCloseTo(30)
  })

  it("forte gain scales by forteRechargePct when buff applies it", () => {
    const forteBuff: BuffDef = {
      id: "char.forte-recharge",
      name: "Forte Recharge",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Basic Attack",
      },
      target: { kind: "self" },
      effects: [
        {
          kind: "stat",
          path: { stat: "forteRechargePct" },
          value: { kind: "const", v: 0.5 },
        },
      ],
      duration: { kind: "permanent" },
    }
    testCharacters = [baseChar({ id: 1, forteCap: 200, buffs: [forteBuff] })]
    const engine = new BuffEngine()
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
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 1,
      forte: 20,
    })
    expect(engine.getResource(1).forte).toBeCloseTo(20 * 1.5)
  })

  it("forte gain clamps at forteCap", () => {
    testCharacters = [baseChar({ id: 1, forteCap: 50 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      forte: 100,
    })
    expect(engine.getResource(1).forte).toBe(50)
  })

  it("on-cast forte applies on skillCast, raw and clamped to forteCap", () => {
    testCharacters = [baseChar({ id: 1, forteCap: 100 })]
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
      forte: 40,
    })
    expect(engine.getResource(1).forte).toBe(40)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 10,
      forte: 80,
    })
    expect(engine.getResource(1).forte).toBe(100)
  })
})

describe("BuffEngine — cooldown", () => {
  const cooldownBuff: BuffDef = {
    id: "test.cooldown",
    name: "Cooldown Buff",
    trigger: { event: "skillCast", actor: "self" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    cooldown: 10,
    effects: [
      {
        kind: "resource",
        resource: "energy",
        op: "add",
        value: { kind: "const", v: 10 },
      },
    ],
  }

  const fire = (engine: BuffEngine, frame: number) =>
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame,
    })

  it("fires on first trigger and grants energy", () => {
    testCharacters = [baseChar({ buffs: [cooldownBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const before = engine.getResource(1).energy
    fire(engine, 0)
    expect(engine.getResource(1).energy).toBe(before + 10)
  })

  it("suppresses re-trigger within cooldown window (9 seconds = 540 frames)", () => {
    testCharacters = [baseChar({ buffs: [cooldownBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    fire(engine, 0)
    const afterFirst = engine.getResource(1).energy
    fire(engine, 539)
    expect(engine.getResource(1).energy).toBe(afterFirst)
  })

  it("allows re-trigger exactly at cooldown boundary (10 seconds = 600 frames)", () => {
    testCharacters = [baseChar({ buffs: [cooldownBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    fire(engine, 0)
    const afterFirst = engine.getResource(1).energy
    fire(engine, 600)
    expect(engine.getResource(1).energy).toBe(afterFirst + 10)
  })
})

describe("BuffEngine — start with full energy", () => {
  const allEmpty = [emptyLoadout, emptyLoadout, emptyLoadout]

  it("seeds each occupied slot to its own maxEnergy", () => {
    testCharacters = [
      baseChar({ id: 1, maxEnergy: 125 }),
      baseChar({ id: 2, maxEnergy: 100 }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: allEmpty,
      startWithFullEnergy: true,
    })
    expect(engine.getResource(1).energy).toBe(125)
    expect(engine.getResource(2).energy).toBe(100)
  })

  it("seeds before grants accrue, so a later gain stacks on top of the full bar (uncapped)", () => {
    testCharacters = [baseChar({ id: 1, maxEnergy: 100 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: allEmpty,
      startWithFullEnergy: true,
    })
    expect(engine.getResource(1).energy).toBe(100)
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 20,
    })
    expect(engine.getResource(1).energy).toBeGreaterThan(100)
  })
})
