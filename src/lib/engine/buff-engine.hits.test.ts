import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter, DamageEntry } from "#/types/character"
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
  dmg,
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

describe("BuffEngine — perStack ValueExpr (#59)", () => {
  const perStackBuff: BuffDef = {
    id: "char.frost-marks",
    name: "Frost Marks",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
    },
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
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.05 + BASE_ATK_PCT)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 10,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.1 + BASE_ATK_PCT)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
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
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.05 + BASE_ATK_PCT)
    // Stack growth via addStack — frozen snapshot ignores new stacks.
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 10,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
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
      skillCategory: "Basic Attack",
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
        skillCategory: "Basic Attack",
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
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.07 + BASE_ATK_PCT)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 50,
    })
    // Replace creates a fresh instance with stacks=1 → snapshot stays at 0.07.
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.07 + BASE_ATK_PCT)
  })
})

describe("BuffEngine — coordHit (#219)", () => {
  const coordDmg = (
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
    effects: [{ kind: "coordHit", damage: coordDmg(), icdFrames: 0 }],
    ...overrides,
  })

  it("(a) coordHit damage fires and is a HitEvent with coord: true and synthetic: true", () => {
    testCharacters = [baseChar({ id: 1, buffs: [coordBuff()] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    const ev = synthetics[0]
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
      effects: [{ kind: "emitHit", damage: coordDmg(), icdFrames: 1000 }],
    }
    testCharacters = [baseChar({ id: 1, buffs: [coordBuff(), synthTrap] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    // coordBuff fires on original (non-synthetic) hit → 1 coord event, no hitLanded emitted.
    // synthTrap requires source: "synthetic" — original hit is not synthetic, so it does not fire.
    // Because coordHit fires no hitLanded, synthTrap NEVER fires.
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    expect(synthetics[0].coord).toBe(true)
  })

  it("(c) coord damage + heal fire on the same frame", () => {
    const coordPairBuff: BuffDef = {
      id: "char.coord-pair",
      name: "Coord Pair",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        { kind: "coordHit", damage: coordDmg(), icdFrames: 0 },
        {
          kind: "coordHit",
          damage: coordDmg({ dmgType: "Heal" }),
          icdFrames: 0,
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [coordPairBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 42,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(2)
    const [dmgEvt, healEvt] = synthetics
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
        {
          kind: "coordHit",
          damage: coordDmg({ dmgType: "Heal" }),
          icdFrames: 0,
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [healCoordBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    const ev = synthetics[0]
    expect(ev.kind).toBe("sustain")
    expect(ev.coord).toBe(true)
    expect(ev.synthetic).toBe(true)
  })
})

describe("BuffEngine — emitHit (#60)", () => {
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
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    expect(synthetics[0]).toMatchObject({
      kind: "hit",
      synthetic: true,
      sourceBuffId: "char.coord",
      characterId: 1,
      frame: 0,
    })
    // damage = 0.5 * ATK * critFactor * DEF_MULT(0.5) * RES_MULT(0.9) (substat + echo main stats applied, with intrinsic 5%/150% base crit folded in)
    const synth0 = synthetics[0]
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
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    // Both a and b fire on the original hit (depth 0). Their synthetics fire
    // hitLanded(synthetic=true). Default `source: "self"` means neither matches
    // the synthetic hitLanded — so no chain.
    expect(drainSynthetics(engine, deferredEmits)).toHaveLength(2)
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
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    const synth = synthetics[0]
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
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(engine.getOnFieldCharacterId()).toBe(1)
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 5,
    })
    drainSynthetics(engine, deferredEmits)
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
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 2,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    // 1.0 * ATK * critFactor * 0.5 * 0.9 * (1 + 0.5 Fusion bonus) (substat + echo main stats applied, with intrinsic 5%/150% base crit folded in).
    const synthEvt = synthetics[0]
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
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics.map((h) => h.sourceBuffId)).toEqual([
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
    const { deferredEmits } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
      energy: 5,
      concerto: 2,
    })
    // The synthetic's energy/concerto apply when its emit decision is drained.
    drainSynthetics(engine, deferredEmits)
    // Authored: +5 energy / +2 concerto. Synthetic: +4 energy / +3 concerto. Both scaled by ER.
    expect(engine.getResource(1).energy).toBeCloseTo(9 * (1 + BASE_ER))
    expect(engine.getResource(1).concerto).toBe(5)
  })
})

describe("BuffEngine — sourceBuffId on synthetic hitLanded trigger filter (#117)", () => {
  it("trigger with sourceBuffId only fires on matching synthetic hit", () => {
    const emitter: BuffDef = {
      id: "char.emitter-a",
      name: "Emitter A",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Heavy Attack",
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

    const { deferredEmits } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Heavy Attack",
      frame: 0,
    })
    // The emitter's synthetic hitLanded — which char.chain triggers on — fires
    // when the emit decision is drained, so resolve it before asserting.
    drainSynthetics(engine, deferredEmits)

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
      skillCategory: "Heavy Attack",
      dmgType: "Fusion",
      frame: 0,
    })

    expect(engine.activeBuffIds(1)).not.toContain("char.chain")
  })
})
