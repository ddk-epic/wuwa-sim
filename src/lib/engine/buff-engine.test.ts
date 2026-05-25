import { afterEach, describe, expect, it, vi } from "vitest"
import { stringmaster } from "#/data/weapons/stringmaster"
import { variation } from "#/data/weapons/variation"
import type { DamageEntry, EnrichedCharacter } from "#/types/character"
import type { WeaponData } from "#/types/weapon"
import type { EnrichedEcho } from "#/types/echo"
import type { EchoSet } from "#/types/echo-set"
import type { BuffDef } from "#/types/buff"
import type { Slots, SlotLoadout } from "#/types/loadout"

import { BuffEngine } from "./buff-engine"
import { pendingNextOnFieldCount } from "./buff-engine.test-utils"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_BUILD_LAYOUT,
  ECHO_MAIN_1COST_SCALING,
  ECHO_SUBSTAT,
} from "../loadout/echo-stat-constants"

const CHARACTER_BASE_CRIT_RATE = 0.05
const BASE_ATK_PCT =
  DEFAULT_SUBSTAT_ROLLS.scalingMain * ECHO_SUBSTAT.atkPct +
  ECHO_BUILD_LAYOUT["4-3-3-1-1"].cost1 * ECHO_MAIN_1COST_SCALING.atk
const BASE_CR =
  CHARACTER_BASE_CRIT_RATE +
  DEFAULT_SUBSTAT_ROLLS.critRate * ECHO_SUBSTAT.critRate
const BASE_ER =
  DEFAULT_SUBSTAT_ROLLS.energyRechargePct * ECHO_SUBSTAT.energyRechargePct

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

const baseChar = (
  overrides: Partial<EnrichedCharacter> = {},
): EnrichedCharacter => ({
  id: 1,
  name: "Test",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [],
  ...overrides,
})

const slotsOf = (id: number): Slots => [id, null, null]
const emptyLoadout: SlotLoadout = {
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
  echoBuild: "4-3-3-1-1",
  cost4Mains: ["cd"],
  cost3Mains: ["elemDmg", "elemDmg"],
}

describe("BuffEngine.onEvent — triggered buffs", () => {
  const skillCastBuff: BuffDef = {
    id: "char.intro",
    name: "Intro Buff",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillType: "Intro Skill",
    },
    target: { kind: "self" },
    duration: { kind: "seconds", v: 14 },
    effects: [
      {
        kind: "stat",
        path: { stat: "skillTypeBonus", key: "Resonance Skill" },
        value: { kind: "const", v: 0.38 },
      },
    ],
  }

  it("applies a buff when its skillCast trigger matches", () => {
    testCharacters = [baseChar({ id: 1, buffs: [skillCastBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.resolveStats(1).skillTypeBonus["Resonance Skill"]).toBe(0)
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Intro Skill",
      frame: 0,
    })
    expect(lifecycleEvents).toHaveLength(1)
    expect(lifecycleEvents[0]).toMatchObject({
      kind: "buffApplied",
      buffId: "char.intro",
      stacks: 1,
      targetCharacterId: 1,
    })
    expect(
      engine.resolveStats(1).skillTypeBonus["Resonance Skill"],
    ).toBeCloseTo(0.38)
  })

  it("does not apply when skillType does not match the trigger filter", () => {
    testCharacters = [baseChar({ id: 1, buffs: [skillCastBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(lifecycleEvents).toEqual([])
  })

  it("emits buffRefreshed and bumps endTime when the same buff retriggers", () => {
    testCharacters = [baseChar({ id: 1, buffs: [skillCastBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Intro Skill",
      frame: 0,
    })
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Intro Skill",
      frame: 60,
    })
    expect(lifecycleEvents).toHaveLength(1)
    expect(lifecycleEvents[0]).toMatchObject({
      kind: "buffRefreshed",
      buffId: "char.intro",
    })
    // 14s = 840 frames. Original endTime would be 840 (apply at 0).
    // After refresh at frame 60, new endTime = 60 + 840 = 900.
    const expired = engine.tickToFrame(841)
    expect(expired.lifecycleEvents).toEqual([])
  })

  it("expires buffs at endTime via tickToFrame and emits buffExpired", () => {
    testCharacters = [baseChar({ id: 1, buffs: [skillCastBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Intro Skill",
      frame: 0,
    })
    const beforeExpiry = engine.tickToFrame(839)
    expect(beforeExpiry.lifecycleEvents).toEqual([])
    expect(
      engine.resolveStats(1).skillTypeBonus["Resonance Skill"],
    ).toBeCloseTo(0.38)
    const atExpiry = engine.tickToFrame(840)
    expect(atExpiry.lifecycleEvents).toHaveLength(1)
    expect(atExpiry.lifecycleEvents[0]).toMatchObject({
      kind: "buffExpired",
      buffId: "char.intro",
    })
    expect(engine.resolveStats(1).skillTypeBonus["Resonance Skill"]).toBe(0)
  })

  it("dedupes by (id, target): re-application from any source refreshes the same instance", () => {
    const teamBuff: BuffDef = {
      id: "ally.shared",
      name: "Shared",
      trigger: {
        event: "skillCast",
        actor: "any",
      },
      target: { kind: "self" },
      duration: { kind: "frames", v: 100 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [
      baseChar({ id: 1, buffs: [teamBuff] }),
      baseChar({ id: 2, buffs: [teamBuff] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // Both source 1 and source 2 self-apply on a generic skillCast — one instance per target.
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    const second = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 10,
    })
    // Second event re-triggers both buffs (one for each source) — both target=1, same id, so refresh.
    expect(
      second.lifecycleEvents.every((e) => e.kind === "buffRefreshed"),
    ).toBe(true)
  })

  it("hitLanded with no synthetic flag fires self-source triggers", () => {
    const onHit: BuffDef = {
      id: "char.onhit",
      name: "OnHit",
      trigger: { event: "hitLanded", characterId: 1 },
      target: { kind: "self" },
      duration: { kind: "frames", v: 60 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.05 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [onHit] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { lifecycleEvents } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 5,
    })
    expect(lifecycleEvents).toHaveLength(1)
    expect(lifecycleEvents[0].kind).toBe("buffApplied")
  })
})

describe("BuffEngine — nextOnField deferred resolution (#57)", () => {
  it("materializes a nextOnField buff at the next swapIn", () => {
    const outro: BuffDef = {
      id: "char.a.outro",
      name: "Outro",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Outro Skill",
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
      skillType: "Basic Attack",
      frame: 0,
    })
    // Cast outro: trigger fires but nothing materializes yet.
    const outroFire = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Outro Skill",
      frame: 50,
    })
    expect(outroFire.lifecycleEvents).toEqual([])
    expect(pendingNextOnFieldCount(engine)).toBe(1)
    expect(engine.resolveStats(2).atkPct).toBeCloseTo(BASE_ATK_PCT)

    // Swap to character 2 — materialize on 2.
    const swap = engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Basic Attack",
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
      trigger: { event: "skillCast", characterId: 1, skillType: "Outro Skill" },
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
      skillType: "Basic Attack",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Outro Skill",
      frame: 10,
    })
    expect(pendingNextOnFieldCount(engine)).toBe(1)
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Basic Attack",
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
      trigger: { event: "skillCast", characterId: 1, skillType: "Outro Skill" },
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
      skillType: "Basic Attack",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Outro Skill",
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
      target: { kind: "team" },
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
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.15 + BASE_ATK_PCT)
    expect(engine.resolveStats(2).atkPct).toBeCloseTo(0.15 + BASE_ATK_PCT)

    // Swap to 2 — source 1 swaps out, instances expire.
    const swap = engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Basic Attack",
      frame: 100,
    })
    const expired = swap.lifecycleEvents.filter(
      (e) => e.kind === "buffExpired" && e.buffId === "char.a.tied-to-source",
    )
    expect(expired.length).toBe(2)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)
    expect(engine.resolveStats(2).atkPct).toBeCloseTo(BASE_ATK_PCT)
  })
})

describe("BuffEngine — resource state (#58)", () => {
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
      skillType: "Basic Attack",
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
      skillType: "Basic Attack",
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
      skillType: "Basic Attack",
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
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 20,
      concerto: 10,
    })
    const fired = c.lifecycleEvents.filter(
      (e) => e.buffId === "char.concerto-ready" && e.kind === "buffApplied",
    )
    expect(fired).toHaveLength(0)
  })

  it("warns when Resonance Liberation casts with insufficient energy but still dispatches, and zeroes energy", () => {
    testCharacters = [baseChar({ id: 1, name: "Test Character" })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Liberation",
      frame: 0,
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain("Test Character")
    expect(warn.mock.calls[0][0]).toContain("0")
    expect(engine.getResource(1).energy).toBe(0)
    warn.mockRestore()
  })

  it("Liberation with energy >= cost zeroes energy and logs no warning", () => {
    testCharacters = [baseChar({ id: 1 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 100,
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Liberation",
      frame: 1,
      resonanceCost: 100,
    })
    expect(warn).not.toHaveBeenCalled()
    expect(engine.getResource(1).energy).toBe(0)
    warn.mockRestore()
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
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 200,
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Liberation",
      frame: 1,
      resonanceCost: 100,
    })
    expect(warn).not.toHaveBeenCalled()
    expect(engine.getResource(1).energy).toBe(0)
    warn.mockRestore()
  })

  it("Encore Liberation at energy=100 warns (cost=125) and zeroes energy", () => {
    testCharacters = [baseChar({ id: 1, name: "Encore" })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 100,
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Liberation",
      frame: 1,
      resonanceCost: 125,
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain("125")
    expect(engine.getResource(1).energy).toBe(0)
    warn.mockRestore()
  })

  it("resourceCrossed dispatched through main pipeline: own resource Effect crossing a threshold fires another buff with emitHit (#62)", () => {
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
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(result.syntheticEvents).toHaveLength(1)
    expect(result.syntheticEvents[0]).toMatchObject({
      kind: "hit",
      synthetic: true,
      sourceBuffId: "char.emit-on-concerto",
      characterId: 1,
    })
  })

  it("resourceCrossed-triggered emitHit chains into hitLanded triggers respecting ICD and depth cap (#62)", () => {
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
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    // resourceCrossed fires chainer (synthetic #1, depth 1). That synthetic
    // hitLanded fires synthChain (synthetic #2, depth 2). And so on, capped
    // at depth 8.
    expect(result.syntheticEvents.length).toBeGreaterThan(1)
    expect(warn).toHaveBeenCalled()
    expect(warn.mock.calls[0][0]).toContain("emitHit chain depth exceeded")
    warn.mockRestore()
  })
})

describe("BuffEngine — per-hit energy sharing (#86)", () => {
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
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 10,
    })
    expect(engine.getResource(1).energy).toBeCloseTo(10 * (1 + BASE_ER))
    expect(engine.getResource(2).energy).toBeCloseTo(10 * 0.5 * (1 + BASE_ER))
    expect(engine.getResource(3).energy).toBeCloseTo(10 * 0.5 * (1 + BASE_ER))
  })

  it("teammate receives exactly actor-ER-scaled share (teammate ER does not compound)", () => {
    // Both actor and teammate have the same BASE_ER from their loadout substats.
    // If teammate ER were applied on top, teammates would get 10 * 0.5 * (1+ER)^2.
    // The correct formula is 10 * 0.5 * (1+actorER) applied once.
    testCharacters = [baseChar({ id: 1 }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 10,
    })
    const actorScaled = 10 * 0.5 * (1 + BASE_ER)
    const doubleScaled = 10 * 0.5 * (1 + BASE_ER) * (1 + BASE_ER)
    expect(engine.getResource(2).energy).toBeCloseTo(actorScaled)
    expect(engine.getResource(2).energy).not.toBeCloseTo(doubleScaled)
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
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 10,
      synthetic: true,
    })
    expect(engine.getResource(1).energy).toBeCloseTo(10 * (1 + BASE_ER))
    expect(engine.getResource(2).energy).toBe(0)
  })

  it("concerto is not shared with teammates", () => {
    testCharacters = [baseChar({ id: 1 }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 8,
    })
    expect(engine.getResource(1).concerto).toBe(8)
    expect(engine.getResource(2).concerto).toBe(0)
  })

  it("single-member party has no teammates to share with", () => {
    testCharacters = [baseChar({ id: 1 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 10,
    })
    expect(engine.getResource(1).energy).toBeCloseTo(10 * (1 + BASE_ER))
  })
})

describe("BuffEngine — forte resource channel (#225)", () => {
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
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      forte: 20,
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
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
        skillType: "Basic Attack",
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
      skillType: "Basic Attack",
      frame: 0,
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
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
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      forte: 100,
    })
    expect(engine.getResource(1).forte).toBe(50)
  })

  it("forte is actor-only and not shared with teammates", () => {
    testCharacters = [
      baseChar({ id: 1, forteCap: 100 }),
      baseChar({ id: 2, forteCap: 100 }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      forte: 15,
    })
    expect(engine.getResource(1).forte).toBe(15)
    expect(engine.getResource(2).forte).toBe(0)
  })

  it("missing forte field on hitLanded is a no-op", () => {
    testCharacters = [baseChar({ id: 1, forteCap: 100 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 5,
    })
    expect(engine.getResource(1).forte).toBe(0)
  })
})

describe("BuffEngine — perStack ValueExpr (#59)", () => {
  const perStackBuff: BuffDef = {
    id: "char.frost-marks",
    name: "Frost Marks",
    trigger: { event: "skillCast", characterId: 1, skillType: "Basic Attack" },
    target: { kind: "self" },
    duration: { kind: "frames", v: 600 },
    stacking: { max: 4, onRetrigger: "addStack" },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "perStack", v: 0.05 },
      },
    ],
  }

  it("contribution scales with current stack count, recomputed on read", () => {
    testCharacters = [baseChar({ id: 1, buffs: [perStackBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.05 + BASE_ATK_PCT)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 10,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.1 + BASE_ATK_PCT)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 20,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.15 + BASE_ATK_PCT)
  })

  it("snapshot:true freezes value at apply time even as stacks later change", () => {
    const snap: BuffDef = {
      ...perStackBuff,
      id: "char.snap-perstack",
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.05, snapshot: true },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [snap] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // First application: stacks=1 at apply, snapshot freezes at 0.05.
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.05 + BASE_ATK_PCT)
    // Stack growth via addStack — frozen snapshot ignores new stacks.
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 10,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 20,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.05 + BASE_ATK_PCT)
  })

  it("const snapshot is symmetrical (value frozen identically to non-snapshot)", () => {
    const buff: BuffDef = {
      id: "char.const-snap",
      name: "Const Snap",
      trigger: { event: "skillCast", characterId: 1 },
      target: { kind: "self" },
      duration: { kind: "frames", v: 100 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2, snapshot: true },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.2 + BASE_ATK_PCT)
  })

  it("replace re-snapshots at the new apply time", () => {
    const buff: BuffDef = {
      id: "char.replace-snap",
      name: "Replace Snap",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Basic Attack",
      },
      target: { kind: "self" },
      duration: { kind: "frames", v: 100 },
      stacking: { max: 1, onRetrigger: "replace" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.07, snapshot: true },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.07 + BASE_ATK_PCT)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 50,
    })
    // Replace creates a fresh instance with stacks=1 → snapshot stays at 0.07.
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.07 + BASE_ATK_PCT)
  })
})

describe("BuffEngine — coordHit (#219)", () => {
  const dmg = (
    overrides: Partial<{
      value: number
      dmgType: string
    }> = {},
  ): DamageEntry => ({
    type: "Resonance Liberation",
    dmgType: "Damage",
    scalingStat: "atk",
    actionFrame: 0,
    value: 1.0,
    energy: 0,
    concerto: 0,
    toughness: 0,
    weakness: 0,
    ...overrides,
  })

  const coordBuff = (overrides: Partial<BuffDef> = {}): BuffDef => ({
    id: "char.coord",
    name: "Coord",
    trigger: { event: "hitLanded", characterId: 1, source: "self" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [{ kind: "coordHit", damage: dmg(), icdFrames: 0 }],
    ...overrides,
  })

  it("(a) coordHit damage fires and is a HitEvent with coord: true and synthetic: true", () => {
    testCharacters = [baseChar({ id: 1, buffs: [coordBuff()] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(result.syntheticEvents).toHaveLength(1)
    const ev = result.syntheticEvents[0]
    expect(ev.kind).toBe("hit")
    expect(ev.coord).toBe(true)
    expect(ev.synthetic).toBe(true)
  })

  it("(b) coordHit-emitted event never enters the matcher — source: synthetic trigger cannot catch it", () => {
    // A buff with source: "synthetic" fires ONLY on synthetic hitLanded events.
    // If coordHit were to fire a hitLanded, this trap buff would catch it.
    // With bypass working: coordHit fires no hitLanded, so the trap never fires.
    const synthTrap: BuffDef = {
      id: "char.synth-trap",
      name: "Synth Trap",
      trigger: { event: "hitLanded", characterId: 1, source: "synthetic" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg(), icdFrames: 1000 }],
    }
    testCharacters = [baseChar({ id: 1, buffs: [coordBuff(), synthTrap] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    // coordBuff fires on original (non-synthetic) hit → 1 coord event, no hitLanded emitted.
    // synthTrap requires source: "synthetic" — original hit is not synthetic, so it does not fire.
    // Because coordHit fires no hitLanded, synthTrap NEVER fires.
    expect(result.syntheticEvents).toHaveLength(1)
    expect(result.syntheticEvents[0].coord).toBe(true)
  })

  it("(c) coord damage + heal fire on the same frame", () => {
    const coordPairBuff: BuffDef = {
      id: "char.coord-pair",
      name: "Coord Pair",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        { kind: "coordHit", damage: dmg(), icdFrames: 0 },
        { kind: "coordHit", damage: dmg({ dmgType: "Heal" }), icdFrames: 0 },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [coordPairBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 42,
    })
    expect(result.syntheticEvents).toHaveLength(2)
    const [dmgEvt, healEvt] = result.syntheticEvents
    expect(dmgEvt.kind).toBe("hit")
    expect(healEvt.kind).toBe("sustain")
    expect(dmgEvt.frame).toBe(42)
    expect(healEvt.frame).toBe(42)
  })

  it("(d) coord heal fires as SustainEvent with coord: true and synthetic: true", () => {
    const healCoordBuff: BuffDef = {
      id: "char.heal-coord",
      name: "Heal Coord",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        { kind: "coordHit", damage: dmg({ dmgType: "Heal" }), icdFrames: 0 },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [healCoordBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(result.syntheticEvents).toHaveLength(1)
    const ev = result.syntheticEvents[0]
    expect(ev.kind).toBe("sustain")
    expect(ev.coord).toBe(true)
    expect(ev.synthetic).toBe(true)
  })
})

describe("BuffEngine — emitHit (#60)", () => {
  const dmg = (
    overrides: Partial<{
      value: number
      dmgType: string
      energy: number
      concerto: number
    }> = {},
  ): DamageEntry => ({
    type: "Basic Attack",
    dmgType: "Fusion",
    scalingStat: "atk",
    actionFrame: 0,
    value: 1.0,
    energy: 0,
    concerto: 0,
    toughness: 0,
    weakness: 0,
    ...overrides,
  })

  const coordOnHit = (
    overrides: Partial<BuffDef> = {},
    icdFrames = 60,
  ): BuffDef => ({
    id: "char.coord",
    name: "Coord",
    trigger: { event: "hitLanded", characterId: 1, source: "self" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [
      {
        kind: "emitHit",
        damage: dmg({ value: 0.5, dmgType: "Fusion" }),
        icdFrames,
      },
    ],
    ...overrides,
  })

  it("emits a synthetic hit when an emitHit-bearing buff is triggered", () => {
    testCharacters = [baseChar({ id: 1, buffs: [coordOnHit()] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(result.syntheticEvents).toHaveLength(1)
    expect(result.syntheticEvents[0]).toMatchObject({
      kind: "hit",
      synthetic: true,
      sourceBuffId: "char.coord",
      characterId: 1,
      frame: 0,
    })
    // damage = 0.5 * ATK * critFactor * DEF_MULT(0.5) * RES_MULT(0.9) (substat + echo main stats applied, with intrinsic 5%/150% base crit folded in)
    const synth0 = result.syntheticEvents[0]
    if (synth0.kind !== "hit") throw new Error("expected HitEvent")
    expect(synth0.damage).toBe(1164)
  })

  it("default hitLanded triggers ignore synthetic hits (no chain reaction)", () => {
    // Two buffs: A is the coord-attack source (emits on Normal Attack).
    // B is a default `hitLanded` trigger that would chain emitHits if it caught synthetics.
    const a = coordOnHit({ id: "a.coord" }, 1)
    const b: BuffDef = {
      id: "b.chained",
      name: "Chained",
      trigger: { event: "hitLanded", characterId: 1 },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg({ value: 1.0 }), icdFrames: 1 }],
    }
    testCharacters = [baseChar({ id: 1, buffs: [a, b] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    // Both a and b fire on the original hit (depth 0). Their synthetics fire
    // hitLanded(synthetic=true). Default `source: "self"` means neither matches
    // the synthetic hitLanded — so no chain.
    expect(result.syntheticEvents).toHaveLength(2)
  })

  it("emitHit with dmgType Heal produces a SustainEvent via computeHealing, not computeDamage", () => {
    const healBuff: BuffDef = {
      id: "char.heal-emit",
      name: "Heal Emit",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: dmg({ value: 0.3, dmgType: "Heal" }),
          icdFrames: 0,
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [healBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(result.syntheticEvents).toHaveLength(1)
    const synth = result.syntheticEvents[0]
    expect(synth.kind).toBe("sustain")
    expect(synth.synthetic).toBe(true)
    expect(synth.sourceBuffId).toBe("char.heal-emit")
    expect(synth.characterId).toBe(1)
    if (synth.kind !== "sustain") throw new Error("narrowing")
    expect(synth.sub).toBe("heal")
    expect(synth.targets).toEqual([1])
    // 0.3 * ATK_effective (1000 base + echo atkPct substats) * (1 + healingBonus=0)
    // ATK_effective matches the echo build in emptyLoadout; verified against runtime output.
    expect(synth.amount).toBe(565)
  })

  it("synthetic hit does not change on-field state", () => {
    const buff: BuffDef = {
      id: "char.field-flip",
      name: "Field flip",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg({ value: 1.0 }), icdFrames: 0 }],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(engine.getOnFieldCharacterId()).toBe(1)
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 5,
    })
    // Synthetic hit attributed to 1 (acting). On-field stays 1 (not flipped).
    expect(engine.getOnFieldCharacterId()).toBe(1)
  })

  it("synthetic damage uses the acting character's stats (source-side element bonus)", () => {
    // Source 1 has +50% Fusion bonus; the on-field character (2) does not.
    // Coord attack should reflect 1's bonus in the synthetic hit's damage.
    const elemBuff: BuffDef = {
      id: "char.fusion-bonus",
      name: "Fusion +50%",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.5 },
        },
      ],
    }
    const coord: BuffDef = {
      id: "char.coord",
      name: "Coord",
      trigger: { event: "hitLanded", characterId: 2, actor: "any" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: dmg({ value: 1.0, dmgType: "Fusion" }),
          icdFrames: 0,
        },
      ],
    }
    testCharacters = [
      baseChar({
        id: 1,
        element: "Fusion",
        buffs: [elemBuff, coord],
      }),
      baseChar({ id: 2 }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // 2 lands a hit; 1 (off-field) emits a synthetic.
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 2,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(result.syntheticEvents).toHaveLength(1)
    // 1.0 * ATK * critFactor * 0.5 * 0.9 * (1 + 0.5 Fusion bonus) (substat + echo main stats applied, with intrinsic 5%/150% base crit folded in).
    const synthEvt = result.syntheticEvents[0]
    if (synthEvt.kind !== "hit") throw new Error("expected HitEvent")
    expect(synthEvt.damage).toBe(3056)
    expect(synthEvt.characterId).toBe(1)
  })

  it("phase pipeline: lex tiebreak by buffDef.id is deterministic", () => {
    const z: BuffDef = {
      id: "z.coord",
      name: "Z",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg({ value: 0.1 }), icdFrames: 0 }],
    }
    const a: BuffDef = {
      id: "a.coord",
      name: "A",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg({ value: 0.1 }), icdFrames: 0 }],
    }
    // Insertion order: z first, a second — output should still be a, then z.
    testCharacters = [baseChar({ id: 1, buffs: [z, a] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(result.syntheticEvents.map((h) => h.sourceBuffId)).toEqual([
      "a.coord",
      "z.coord",
    ])
  })

  it("synthetic hits accumulate energy/concerto on the source character", () => {
    const buff: BuffDef = {
      id: "char.coord",
      name: "Coord",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: dmg({ value: 1.0, energy: 4, concerto: 3 }),
          icdFrames: 0,
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
      energy: 5,
      concerto: 2,
    })
    // Authored: +5 energy / +2 concerto. Synthetic: +4 energy / +3 concerto. Both scaled by ER.
    expect(engine.getResource(1).energy).toBeCloseTo(9 * (1 + BASE_ER))
    expect(engine.getResource(1).concerto).toBe(5)
  })
})

describe("BuffEngine.resolveStats — fallback", () => {
  it("returns base atk for known character not in any slot", () => {
    testCharacters = [baseChar()]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [null, null, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.resolveStats(1).atkBase).toBe(1000)
  })
})

describe("BuffEngine — consumedBy (#61)", () => {
  const guaranteedCrit: BuffDef = {
    id: "char.next-basic-crit",
    name: "Next Basic Guaranteed Crit",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
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
      skillType: "Basic Attack",
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
      skillType: "Resonance Skill",
      frame: 0,
    })
    expect(engine.resolveStats(1).critRate).toBeCloseTo(1 + BASE_CR)
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
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
      skillType: "Resonance Skill",
      frame: 0,
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Heavy Attack",
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
        skillType: "Resonance Skill",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      stacking: { max: 3, onRetrigger: "addStack" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.1 },
        },
      ],
      consumedBy: {
        event: "hitLanded",
        skillType: "Basic Attack",
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
      skillType: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 1,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 2,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.3 + BASE_ATK_PCT)

    const r1 = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
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
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 20,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.1 + BASE_ATK_PCT)

    const r3 = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
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
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(r.syntheticEvents).toHaveLength(1)
    expect(r.lifecycleEvents.some((e) => e.kind === "buffConsumed")).toBe(true)
  })
})

describe("BuffEngine — perSource (#61)", () => {
  const sharedBuff = (perSource: boolean): BuffDef => ({
    id: "team.shared",
    name: "Shared",
    trigger: { event: "skillCast", actor: "any", skillType: "Resonance Skill" },
    target: { kind: "team" },
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
      skillType: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Resonance Skill",
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
      skillType: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Resonance Skill",
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
        skillType: "Basic Attack",
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
        skillType: "Basic Attack",
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
        skillType: "Basic Attack",
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
        skillType: "Basic Attack",
        frame: 0,
      })
      expect(info).not.toHaveBeenCalled()
    } finally {
      info.mockRestore()
    }
  })
})

describe("BuffEngine — phase pipeline as data", () => {
  it("a stat Effect in a later phase sees Resource State mutated by an earlier phase", () => {
    // Two buffs trigger off the same skillCast event.
    //   - resourceBuff fires in the resource phase, adding 50 concerto.
    //   - statBuff fires in the stat phase (applyBuff). It carries a stat
    //     effect (+0.5 atkPct) gated by a Condition resourceAtLeast(concerto, 50).
    // Because the resource phase runs first, statBuff's Condition is satisfied
    // when resolveStats later reads concerto, and the +0.5 contribution lands.
    // Buff ids ensure resourceBuff's id sorts BEFORE statBuff's id so that,
    // even within a single phase, candidates are processed in the lex order
    // pinned by ADR-0006.
    const resourceBuff: BuffDef = {
      id: "char.test.aResource",
      name: "Adds Concerto",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Basic Attack",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "resource",
          resource: "concerto",
          op: "add",
          value: { kind: "const", v: 50 },
          target: "self",
        },
      ],
    }
    const statBuff: BuffDef = {
      id: "char.test.bStat",
      name: "Conditional ATK%",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Basic Attack",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      condition: {
        kind: "resourceAtLeast",
        resource: "concerto",
        n: 50,
        on: "source",
      },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.5 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [resourceBuff, statBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.getResource(1).concerto).toBe(0)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)

    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })

    expect(engine.getResource(1).concerto).toBe(50)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.5 + BASE_ATK_PCT)
  })
})

describe("BuffEngine — resolveHit + recordHit (deep seam, #67)", () => {
  it("resolveHit then recordHit is equivalent to tickToFrame + resolveStats + onEvent + getResource", () => {
    const trigger: BuffDef = {
      id: "char.hit.bonus",
      name: "Hit Bonus",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 5 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [trigger] })]

    const oldEngine = new BuffEngine()
    oldEngine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const oldTick = oldEngine.tickToFrame(30)
    const oldStats = oldEngine.resolveStats(1)
    const oldActiveBuffIds = oldEngine.activeBuffIds(1)
    const oldDispatch = oldEngine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 30,
      energy: 5,
      concerto: 2,
    })
    const oldPostState = oldEngine.getResource(1)

    const newEngine = new BuffEngine()
    newEngine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const resolved = newEngine.resolveHit(1, 30)
    const dispatch = newEngine.recordHit({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 30,
      energy: 5,
      concerto: 2,
    })

    expect(resolved.lifecycleEvents).toEqual(oldTick.lifecycleEvents)
    expect(resolved.stats).toEqual(oldStats)
    expect(resolved.activeBuffs.map((b) => b.id).sort()).toEqual(
      oldActiveBuffIds,
    )
    expect(dispatch.lifecycleEvents).toEqual(oldDispatch.lifecycleEvents)
    expect(dispatch.syntheticEvents).toEqual(oldDispatch.syntheticEvents)
    expect(dispatch.postState).toEqual(oldPostState)
  })
})

describe("BuffEngine — cooldown (#90)", () => {
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
      skillType: "Basic Attack",
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

  it("does not suppress buffs without cooldown", () => {
    const noCooldown: BuffDef = {
      ...cooldownBuff,
      id: "test.no-cooldown",
      cooldown: undefined,
    }
    testCharacters = [baseChar({ buffs: [noCooldown] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    fire(engine, 0)
    const afterFirst = engine.getResource(1).energy
    fire(engine, 1)
    expect(engine.getResource(1).energy).toBe(afterFirst + 10)
  })
})

describe("Stringmaster weapon passive — Electric Amplification", () => {
  const STRINGMASTER_ID = 21050016

  const bootstrapStringmaster = (rank: number, slots: Slots = slotsOf(1)) => {
    testWeapons = [stringmaster]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots,
      loadouts: [
        {
          weaponId: STRINGMASTER_ID,
          weaponRank: rank,
          echoId: null,
          echoSetSlot1Id: null,
          echoSetSlot2Id: null,
          sequence: 0,
          echoBuild: "4-3-3-1-1",
          cost4Mains: ["cd"],
          cost3Mains: ["elemDmg", "elemDmg"],
        },
        emptyLoadout,
        emptyLoadout,
      ],
    })
    return engine
  }

  it("buff 1: allDmgBonus is applied at simStart for all ranks", () => {
    const values = [0.12, 0.15, 0.18, 0.21, 0.24]
    for (let rank = 1; rank <= 5; rank++) {
      testCharacters = [baseChar({ id: 1, element: "Electro" })]
      const engine = bootstrapStringmaster(rank)
      expect(engine.resolveStats(1).allDmgBonus).toBeCloseTo(values[rank - 1])
    }
  })

  it("buff 2: atkPct stacks up to 2× on Resonance Skill cast, expires after 5s", () => {
    testCharacters = [baseChar({ id: 1, element: "Electro" })]
    const engine = bootstrapStringmaster(1)

    // Bring 1 on-field so off-field buff (buff 3) is inactive
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    const baseAtk = engine.resolveStats(1).atkPct

    // First Resonance Skill cast — 1 stack (×0.12 at rank 1)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 10,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(baseAtk + 0.12)

    // Second cast — 2 stacks (max)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 20,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(baseAtk + 0.24)

    // Third cast — still capped at 2 stacks
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 30,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(baseAtk + 0.24)

    // After 5s (300 frames) from last cast, stacks expire (last cast at frame 30, expires at frame 330)
    engine.tickToFrame(331)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(baseAtk)
  })

  it("buff 3 rank 1: off-field atkPct active only while wielder is off-field", () => {
    testCharacters = [
      baseChar({ id: 1, element: "Electro" }),
      baseChar({ id: 2 }),
    ]
    const engine = bootstrapStringmaster(1, [1, 2, null])

    // Before any swap: source not on-field → off-field buff contributes
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT + 0.12)

    // Bring 1 on-field: condition false
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)

    // Swap to 2: 1 is off-field again → condition true
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Basic Attack",
      frame: 60,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT + 0.12)
  })

  it("buff 3 rank 5: off-field atkPct is 0.24", () => {
    testCharacters = [
      baseChar({ id: 1, element: "Electro" }),
      baseChar({ id: 2 }),
    ]
    const engine = bootstrapStringmaster(5, [1, 2, null])
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Basic Attack",
      frame: 60,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT + 0.24)
  })
})

describe("BuffEngine.passiveBuffs", () => {
  const passiveBuff = (id: string, name: string): BuffDef => ({
    id,
    name,
    trigger: { event: "simStart" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 0.1 },
      },
    ],
  })

  it("returns empty array when character has no folded buffs", () => {
    testCharacters = [baseChar({ id: 1, buffs: [] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.passiveBuffs(1)).toEqual([])
  })

  it("returns folded buffs as ActiveBuff entries with stacks:1", () => {
    testCharacters = [
      baseChar({
        id: 1,
        buffs: [
          passiveBuff("skill-tree.atk", "ATK"),
          passiveBuff("weapon.amp", "Amplification"),
        ],
      }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.passiveBuffs(1)).toEqual([
      { id: "skill-tree.atk", name: "ATK", stacks: 1 },
      { id: "weapon.amp", name: "Amplification", stacks: 1 },
    ])
  })

  it("does not include conditional passives (permanentInstances) in passiveBuffs", () => {
    testCharacters = [
      baseChar({
        id: 1,
        buffs: [
          passiveBuff("skill-tree.atk", "ATK"),
          {
            ...passiveBuff("weapon.conditional", "Conditional"),
            condition: { kind: "actorIsOffField" },
          },
        ],
      }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const ids = engine.passiveBuffs(1).map((b) => b.id)
    expect(ids).toEqual(["skill-tree.atk"])
  })

  it("resolveHit includes passiveBuffs matching passiveBuffs()", () => {
    testCharacters = [
      baseChar({
        id: 1,
        buffs: [passiveBuff("echo-set.molten-2pc", "Molten Rift (2pc)")],
        skills: [],
      }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const resolved = engine.resolveHit(1, 0)
    expect(resolved.passiveBuffs).toEqual(engine.passiveBuffs(1))
  })
})

describe("BuffEngine — sourceBuffId on synthetic hitLanded trigger filter (#117)", () => {
  const dmg = (): DamageEntry => ({
    type: "Basic Attack",
    dmgType: "Fusion",
    scalingStat: "atk",
    actionFrame: 0,
    value: 1.0,
    energy: 0,
    concerto: 0,
    toughness: 0,
    weakness: 0,
  })

  it("trigger with sourceBuffId only fires on matching synthetic hit", () => {
    const emitter: BuffDef = {
      id: "char.emitter-a",
      name: "Emitter A",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Heavy Attack",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg(), icdFrames: 0 }],
    }
    const chainBuff: BuffDef = {
      id: "char.chain",
      name: "Chain",
      trigger: {
        event: "hitLanded",
        source: "synthetic",
        characterId: 1,
        sourceBuffId: "char.emitter-a",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [emitter, chainBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Heavy Attack",
      frame: 0,
    })

    expect(engine.activeBuffIds(1)).toContain("char.chain")
  })

  it("trigger with sourceBuffId does not fire on authored hitLanded (no sourceBuffId)", () => {
    const chainBuff: BuffDef = {
      id: "char.chain",
      name: "Chain",
      trigger: {
        event: "hitLanded",
        source: "any",
        characterId: 1,
        sourceBuffId: "char.emitter-a",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [chainBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Heavy Attack",
      dmgType: "Fusion",
      frame: 0,
    })

    expect(engine.activeBuffIds(1)).not.toContain("char.chain")
  })
})

describe("BuffEngine — condition-at-trigger for reaction-shaped defs (#116)", () => {
  const dmg = (): DamageEntry => ({
    type: "Basic Attack",
    dmgType: "Fusion",
    scalingStat: "atk",
    actionFrame: 0,
    value: 1.0,
    energy: 0,
    concerto: 0,
    toughness: 0,
    weakness: 0,
  })

  const windowBuff: BuffDef = {
    id: "test.window",
    name: "Window",
    trigger: { event: "skillCast", characterId: 1, skillType: "Echo Skill" },
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

  const emitHitWithCondition: BuffDef = {
    id: "test.conditional-emit",
    name: "Conditional Emit",
    trigger: { event: "skillCast", characterId: 1, skillType: "Outro Skill" },
    condition: { kind: "buffActive", buffId: "test.window", on: "source" },
    effects: [{ kind: "emitHit", damage: dmg(), icdFrames: 0 }],
  }

  it("does not fire synthetic hit when condition buff is absent", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [windowBuff, emitHitWithCondition] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Outro Skill",
      frame: 0,
    })
    expect(result.syntheticEvents).toHaveLength(0)
  })

  it("fires synthetic hit when condition buff is active", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [windowBuff, emitHitWithCondition] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    // Activate the window buff
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Echo Skill",
      frame: 0,
    })

    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Outro Skill",
      frame: 1,
    })
    expect(result.syntheticEvents).toHaveLength(1)
    expect(result.syntheticEvents[0].synthetic).toBe(true)
  })

  it("does not suppress reaction defs without a condition", () => {
    const unconditionalEmit: BuffDef = {
      id: "test.unconditional-emit",
      name: "Unconditional Emit",
      trigger: { event: "skillCast", characterId: 1, skillType: "Outro Skill" },
      effects: [{ kind: "emitHit", damage: dmg(), icdFrames: 0 }],
    }
    testCharacters = [baseChar({ id: 1, buffs: [unconditionalEmit] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Outro Skill",
      frame: 0,
    })
    expect(result.syntheticEvents).toHaveLength(1)
  })
})

describe("BuffEngine — condition-at-trigger for nextOnField stat buffs (#116)", () => {
  const windowBuff: BuffDef = {
    id: "test.window",
    name: "Window",
    trigger: { event: "skillCast", characterId: 1, skillType: "Echo Skill" },
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
    trigger: { event: "skillCast", characterId: 1, skillType: "Outro Skill" },
    target: { kind: "nextOnField" },
    duration: { kind: "seconds", v: 15 },
    condition: { kind: "buffActive", buffId: "test.window", on: "source" },
    effects: [
      {
        kind: "stat",
        path: { stat: "allDmgBonus" },
        value: { kind: "const", v: 0.12 },
      },
    ],
  }

  it("does not enqueue nextOnField buff when condition is false at trigger time", () => {
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
      skillType: "Outro Skill",
      frame: 0,
    })
    // Swap in char 2 — buff should NOT be applied
    engine.onEvent({ kind: "swapIn", characterId: 2, frame: 1 })

    expect(engine.activeBuffIds(2)).not.toContain("test.conditional-nof")
  })

  it("enqueues nextOnField buff when condition is true at trigger time", () => {
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
      skillType: "Echo Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Outro Skill",
      frame: 1,
    })
    // Swap in char 2 — buff SHOULD be applied
    engine.onEvent({ kind: "swapIn", characterId: 2, frame: 2 })

    expect(engine.activeBuffIds(2)).toContain("test.conditional-nof")
  })
})

describe("Variation weapon — Ceaseless Aria concerto restore", () => {
  const FPS = 60

  function setupVariation(rank: number) {
    const char = baseChar({ id: 10 })
    testCharacters = [char]
    testWeapons = [variation]
    const loadout: SlotLoadout = {
      ...emptyLoadout,
      weaponId: variation.id,
      weaponRank: rank,
    }
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [10, null, null],
      loadouts: [loadout, emptyLoadout, emptyLoadout],
    })
    return engine
  }

  it.each([1, 2, 3, 4, 5])(
    "rank %i: Resonance Skill cast restores correct concerto",
    (rank) => {
      const expected = [8, 10, 12, 14, 16][rank - 1]
      const engine = setupVariation(rank)
      engine.onEvent({
        kind: "skillCast",
        characterId: 10,
        skillType: "Resonance Skill",
        frame: 0,
      })
      expect(engine.getResource(10).concerto).toBe(expected)
    },
  )

  it("cooldown: second cast within 20s does not restore concerto again", () => {
    const engine = setupVariation(1)
    engine.onEvent({
      kind: "skillCast",
      characterId: 10,
      skillType: "Resonance Skill",
      frame: 0,
    })
    const afterFirst = engine.getResource(10).concerto
    engine.onEvent({
      kind: "skillCast",
      characterId: 10,
      skillType: "Resonance Skill",
      frame: 10 * FPS - 1,
    })
    expect(engine.getResource(10).concerto).toBe(afterFirst)
  })

  it("cooldown: cast after 20s does restore concerto again", () => {
    const engine = setupVariation(1)
    engine.onEvent({
      kind: "skillCast",
      characterId: 10,
      skillType: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 10,
      skillType: "Resonance Skill",
      frame: 20 * FPS,
    })
    expect(engine.getResource(10).concerto).toBe(8 + 8)
  })
})

describe("BuffEngine — ADR-0011: target collapses to source at trigger time", () => {
  it("nextOnField def with cond.on=target evaluates against source, not nextOnField char", () => {
    const windowBuff: BuffDef = {
      id: "test.window",
      name: "Window",
      trigger: { event: "skillCast", characterId: 1, skillType: "Echo Skill" },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 15 },
      effects: [],
    }
    // Condition uses on: "target" — at trigger time this collapses to source (char 1)
    const nextOnFieldDef: BuffDef = {
      id: "test.nof-target-cond",
      name: "NOF target cond",
      trigger: { event: "skillCast", characterId: 1, skillType: "Outro Skill" },
      target: { kind: "nextOnField" },
      duration: { kind: "seconds", v: 15 },
      condition: { kind: "buffActive", buffId: "test.window", on: "target" },
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
      skillType: "Echo Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Outro Skill",
      frame: 1,
    })
    // Swap in char 2 — condition should pass because window is active on char 1 (source = target)
    engine.onEvent({ kind: "swapIn", characterId: 2, frame: 2 })

    expect(engine.activeBuffIds(2)).toContain("test.nof-target-cond")
  })

  it("nextOnField def with cond.on=target does not pass when source lacks the buff", () => {
    const nextOnFieldDef: BuffDef = {
      id: "test.nof-target-absent",
      name: "NOF target absent",
      trigger: { event: "skillCast", characterId: 1, skillType: "Outro Skill" },
      target: { kind: "nextOnField" },
      duration: { kind: "seconds", v: 15 },
      condition: { kind: "buffActive", buffId: "test.absent", on: "target" },
      effects: [
        {
          kind: "stat",
          path: { stat: "allDmgBonus" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [
      baseChar({ id: 1, buffs: [nextOnFieldDef] }),
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
      skillType: "Outro Skill",
      frame: 0,
    })
    engine.onEvent({ kind: "swapIn", characterId: 2, frame: 1 })

    expect(engine.activeBuffIds(2)).not.toContain("test.nof-target-absent")
  })
})

describe("BuffEngine — reaction-shaped BuffDef (#220)", () => {
  it("reaction fires resource effect and grants forte to source character", () => {
    const reactionBuff: BuffDef = {
      id: "test.reaction-forte",
      name: "Reaction Forte Grant",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Basic Attack",
      },
      effects: [
        {
          kind: "resource",
          resource: "forte",
          op: "add",
          value: { kind: "const", v: 1 },
        },
      ],
    }
    testCharacters = [baseChar({ buffs: [reactionBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    expect(engine.getResource(1).forte).toBe(1)
  })

  it("reaction emits no buffApplied or buffExpired lifecycle events", () => {
    const reactionBuff: BuffDef = {
      id: "test.reaction-no-log",
      name: "Reaction No Log",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Basic Attack",
      },
      effects: [
        {
          kind: "resource",
          resource: "forte",
          op: "add",
          value: { kind: "const", v: 1 },
        },
      ],
    }
    testCharacters = [baseChar({ buffs: [reactionBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Basic Attack",
      frame: 0,
    })
    const buffEvents = lifecycleEvents.filter(
      (e) =>
        e.kind === "buffApplied" ||
        e.kind === "buffExpired" ||
        e.kind === "buffRefreshed" ||
        e.kind === "buffConsumed",
    )
    expect(buffEvents).toHaveLength(0)
  })

  it("verina forte.grant-skill reaction: gains +1 forte on Botany Experiment hit (canary)", () => {
    const reactionBuff: BuffDef = {
      id: "char.verina.forte.grant-skill",
      name: "Forte: Botany Experiment Grant",
      trigger: {
        event: "hitLanded",
        characterId: 1503,
        stageId: "Botany Experiment::",
        hitIndex: 1,
      },
      effects: [
        {
          kind: "resource",
          resource: "forte",
          op: "add",
          value: { kind: "const", v: 1 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1503, buffs: [reactionBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1503),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { lifecycleEvents } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1503,
      skillType: "Resonance Skill",
      dmgType: "Physical",
      stageId: "Botany Experiment::",
      hitIndex: 1,
      frame: 0,
    })
    expect(engine.getResource(1503).forte).toBe(1)
    const buffLogEvents = lifecycleEvents.filter(
      (e) =>
        (e.kind === "buffApplied" || e.kind === "buffExpired") &&
        "buffId" in e &&
        e.buffId === "char.verina.forte.grant-skill",
    )
    expect(buffLogEvents).toHaveLength(0)
  })
})

describe("Global buffs — Binary Butterfly", () => {
  const shorekeeperId = 1505
  const teammateId = 2

  it("grants team-wide allDeepen when Shorekeeper casts Outro Skill", () => {
    testCharacters = [
      baseChar({ id: shorekeeperId }),
      baseChar({ id: teammateId }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [shorekeeperId, teammateId, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    expect(engine.resolveStats(shorekeeperId).allDeepen).toBe(0)
    expect(engine.resolveStats(teammateId).allDeepen).toBe(0)

    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: shorekeeperId,
      skillType: "Outro Skill",
      frame: 0,
    })

    const applied = lifecycleEvents.filter(
      (e) =>
        e.kind === "buffApplied" &&
        "buffId" in e &&
        e.buffId === "char.shorekeeper.outro.binary-butterfly",
    )
    expect(applied).toHaveLength(2)

    expect(engine.resolveStats(shorekeeperId).allDeepen).toBeCloseTo(0.15)
    expect(engine.resolveStats(teammateId).allDeepen).toBeCloseTo(0.15)
  })

  it("is not seeded when Shorekeeper is not in the party", () => {
    testCharacters = [baseChar({ id: teammateId })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [teammateId, null, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: teammateId,
      skillType: "Outro Skill",
      frame: 0,
    })

    const applied = lifecycleEvents.filter(
      (e) =>
        e.kind === "buffApplied" &&
        "buffId" in e &&
        e.buffId === "char.shorekeeper.outro.binary-butterfly",
    )
    expect(applied).toHaveLength(0)
  })
})

describe("Global buffs — Inner/Supernal Stellarealm (scaledByStat)", () => {
  const shorekeeperId = 1505
  const teammateId = 2
  const shorekeeper = baseChar({ id: shorekeeperId })
  const teammate = baseChar({ id: teammateId })

  const setup = () => {
    testCharacters = [shorekeeper, teammate]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [shorekeeperId, teammateId, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    return engine
  }

  it("Inner Stellarealm: Intro while Outer active grants critRate scaled by Shorekeeper ER", () => {
    const engine = setup()
    const preCritRate = engine.resolveStats(teammateId).critRate

    // Shorekeeper casts Liberation → applies Outer Stellarealm (marker)
    engine.onEvent({
      kind: "skillCast",
      characterId: shorekeeperId,
      skillType: "Resonance Liberation",
      frame: 0,
    })
    expect(engine.activeBuffIds(shorekeeperId)).toContain(
      "char.shorekeeper.lib.outer-stellarealm",
    )

    // Teammate casts Intro Skill → triggers Inner Stellarealm
    engine.onEvent({
      kind: "skillCast",
      characterId: teammateId,
      skillType: "Intro Skill",
      frame: 60,
    })
    expect(engine.activeBuffIds(teammateId)).toContain(
      "char.shorekeeper.lib.inner-stellarealm",
    )

    // Shorekeeper's energyRechargePct uses base ER (breaks self-cycle via guard)
    const erPct = BASE_ER
    // Inner Stellarealm adds critRate = min((1 + erPct) / 0.002 * 0.0001, 0.125)
    const expectedCritRateBonus = Math.min(
      ((1 + erPct) / 0.002) * 0.0001,
      0.125,
    )
    expect(engine.resolveStats(teammateId).critRate).toBeCloseTo(
      preCritRate + expectedCritRateBonus,
    )
  })

  it("Supernal Stellarealm: second Intro while Inner active grants critDmg scaled by Shorekeeper ER", () => {
    const engine = setup()
    const preCritDmg = engine.resolveStats(teammateId).critDmg

    engine.onEvent({
      kind: "skillCast",
      characterId: shorekeeperId,
      skillType: "Resonance Liberation",
      frame: 0,
    })
    // First Intro → Inner Stellarealm
    engine.onEvent({
      kind: "skillCast",
      characterId: teammateId,
      skillType: "Intro Skill",
      frame: 60,
    })
    expect(engine.activeBuffIds(teammateId)).toContain(
      "char.shorekeeper.lib.inner-stellarealm",
    )
    // Second Intro → Supernal Stellarealm
    engine.onEvent({
      kind: "skillCast",
      characterId: teammateId,
      skillType: "Intro Skill",
      frame: 120,
    })
    expect(engine.activeBuffIds(teammateId)).toContain(
      "char.shorekeeper.lib.supernal-stellarealm",
    )

    const erPct = BASE_ER
    const expectedCritDmgBonus = Math.min(((1 + erPct) / 0.001) * 0.0001, 0.25)
    expect(engine.resolveStats(teammateId).critDmg).toBeCloseTo(
      preCritDmg + expectedCritDmgBonus,
    )
  })

  it("Inner Stellarealm does not apply without Outer Stellarealm active", () => {
    const engine = setup()
    // Intro without Liberation first → no Outer Stellarealm
    engine.onEvent({
      kind: "skillCast",
      characterId: teammateId,
      skillType: "Intro Skill",
      frame: 0,
    })
    // Inner may be applied but expires immediately (inherits Outer duration = none)
    engine.tickToFrame(1)
    expect(engine.activeBuffIds(teammateId)).not.toContain(
      "char.shorekeeper.lib.inner-stellarealm",
    )
  })
})
