import { afterEach, describe, expect, it, vi } from "vitest"
import { shorekeeper } from "#/data/characters/shorekeeper"
import { stellarSymphony } from "#/data/weapons/stellar-symphony"
import { stringmaster } from "#/data/weapons/stringmaster"
import { variation } from "#/data/weapons/variation"
import { fallacyOfNoReturn } from "#/data/echoes/fallacy-of-no-return"
import type { DamageEntry, EnrichedCharacter } from "#/types/character"
import type { WeaponData } from "#/types/weapon"
import type { EnrichedEcho } from "#/types/echo"
import type { EchoSet } from "#/types/echo-set"
import type { BuffDef } from "#/types/buff"
import type { Slots, SlotLoadout } from "#/types/loadout"

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
      skillCategory: "Basic Attack",
      frame: 0,
    })
    const baseAtk = engine.resolveStats(1).atkPct

    // First Resonance Skill cast — 1 stack (×0.12 at rank 1)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 10,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(baseAtk + 0.12)

    // Second cast — 2 stacks (max)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 20,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(baseAtk + 0.24)

    // Third cast — still capped at 2 stacks
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
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
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)

    // Swap to 2: 1 is off-field again → condition true
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillCategory: "Basic Attack",
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
      skillCategory: "Basic Attack",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillCategory: "Basic Attack",
      frame: 60,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT + 0.24)
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

  const emitHitWithCondition: BuffDef = {
    id: "test.conditional-emit",
    name: "Conditional Emit",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
    },
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

    const { deferredEmits } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 0,
    })
    expect(drainSynthetics(engine, deferredEmits)).toHaveLength(0)
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
      skillCategory: "Echo Skill",
      frame: 0,
    })

    const { deferredEmits } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 1,
    })
    const synthetics = drainSynthetics(engine, deferredEmits)
    expect(synthetics).toHaveLength(1)
    expect(synthetics[0].synthetic).toBe(true)
  })

  it("does not suppress reaction defs without a condition", () => {
    const unconditionalEmit: BuffDef = {
      id: "test.unconditional-emit",
      name: "Unconditional Emit",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Outro Skill",
      },
      effects: [{ kind: "emitHit", damage: dmg(), icdFrames: 0 }],
    }
    testCharacters = [baseChar({ id: 1, buffs: [unconditionalEmit] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    const { deferredEmits } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Outro Skill",
      frame: 0,
    })
    expect(drainSynthetics(engine, deferredEmits)).toHaveLength(1)
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
        skillCategory: "Resonance Skill",
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
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    const afterFirst = engine.getResource(10).concerto
    engine.onEvent({
      kind: "skillCast",
      characterId: 10,
      skillCategory: "Resonance Skill",
      frame: 10 * FPS - 1,
    })
    expect(engine.getResource(10).concerto).toBe(afterFirst)
  })

  it("cooldown: cast after 20s does restore concerto again", () => {
    const engine = setupVariation(1)
    engine.onEvent({
      kind: "skillCast",
      characterId: 10,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 10,
      skillCategory: "Resonance Skill",
      frame: 20 * FPS,
    })
    expect(engine.getResource(10).concerto).toBe(8 + 8)
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
        skillCategory: "Basic Attack",
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
      skillCategory: "Basic Attack",
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
        skillCategory: "Basic Attack",
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
      skillCategory: "Basic Attack",
      frame: 0,
    })
    // Every BuffEvent kind is a lifecycle event, so asserting none fired
    // is equivalent to asserting the list is empty.
    expect(lifecycleEvents).toHaveLength(0)
  })

  it("verina forte.grant-skill reaction: gains +1 forte on Botany Experiment hit (canary)", () => {
    const reactionBuff: BuffDef = {
      id: "char.verina.forte.grant-skill",
      name: "Forte: Botany Experiment Grant",
      trigger: {
        event: "hitLanded",
        characterId: 1503,
        stageId: "char.verina.resonance-skill.botany-experiment._.1",
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
      skillCategory: "Resonance Skill",
      dmgType: "Physical",
      stageId: "char.verina.resonance-skill.botany-experiment._.1",
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

  it("grants team-wide allAmp when Shorekeeper casts Outro Skill", () => {
    testCharacters = [shorekeeper, baseChar({ id: teammateId })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [shorekeeperId, teammateId, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    expect(engine.resolveStats(shorekeeperId).allAmp).toBe(0)
    expect(engine.resolveStats(teammateId).allAmp).toBe(0)

    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: shorekeeperId,
      skillCategory: "Outro Skill",
      frame: 0,
    })

    const applied = lifecycleEvents.filter(
      (e) =>
        e.kind === "buffApplied" &&
        "buffId" in e &&
        e.buffId === "char.shorekeeper.outro.binary-butterfly",
    )
    expect(applied).toHaveLength(1)

    expect(engine.resolveStats(shorekeeperId).allAmp).toBeCloseTo(0.15)
    expect(engine.resolveStats(teammateId).allAmp).toBeCloseTo(0.15)
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
      skillCategory: "Outro Skill",
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
      skillCategory: "Resonance Liberation",
      frame: 0,
    })
    expect(engine.activeBuffIds(shorekeeperId)).toContain(
      "char.shorekeeper.lib.outer-stellarealm",
    )

    // Teammate casts Intro Skill → triggers Inner Stellarealm
    engine.onEvent({
      kind: "skillCast",
      characterId: teammateId,
      skillCategory: "Intro Skill",
      frame: 60,
    })
    expect(engine.activeBuffIds(teammateId)).toContain(
      "char.shorekeeper.lib.inner-stellarealm",
    )

    // Self Gravitation fires with Liberation and adds +10% ER to Shorekeeper
    const erPct = BASE_ER + 0.1
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
      skillCategory: "Resonance Liberation",
      frame: 0,
    })
    // First Intro → Inner Stellarealm
    engine.onEvent({
      kind: "skillCast",
      characterId: teammateId,
      skillCategory: "Intro Skill",
      frame: 60,
    })
    expect(engine.activeBuffIds(teammateId)).toContain(
      "char.shorekeeper.lib.inner-stellarealm",
    )
    // Second Intro → Supernal Stellarealm
    engine.onEvent({
      kind: "skillCast",
      characterId: teammateId,
      skillCategory: "Intro Skill",
      frame: 120,
    })
    expect(engine.activeBuffIds(teammateId)).toContain(
      "char.shorekeeper.lib.supernal-stellarealm",
    )

    // Self Gravitation fires with Liberation and adds +10% ER to Shorekeeper
    const erPct = BASE_ER + 0.1
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
      skillCategory: "Intro Skill",
      frame: 0,
    })
    // Inner may be applied but expires immediately (inherits Outer duration = none)
    engine.tickToFrame(1)
    expect(engine.activeBuffIds(teammateId)).not.toContain(
      "char.shorekeeper.lib.inner-stellarealm",
    )
  })
})

describe("Stellar Symphony weapon — Astral Evolvement buffs", () => {
  const FPS = 60

  function setupStellarSymphony(rank: number) {
    const char = baseChar({ id: 20 })
    testCharacters = [char]
    testWeapons = [stellarSymphony]
    const loadout: SlotLoadout = {
      ...emptyLoadout,
      weaponId: stellarSymphony.id,
      weaponRank: rank,
    }
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [20, null, null],
      loadouts: [loadout, emptyLoadout, emptyLoadout],
    })
    return engine
  }

  it.each([1, 2, 3, 4, 5])(
    "rank %i: HP% passive folds into stats at sim start",
    (rank) => {
      const expected = [0.12, 0.15, 0.18, 0.21, 0.24][rank - 1]
      const engine = setupStellarSymphony(rank)
      expect(engine.resolveStats(20).hpPct).toBeCloseTo(expected)
    },
  )

  it.each([1, 2, 3, 4, 5])(
    "rank %i: Resonance Liberation cast restores correct concerto",
    (rank) => {
      const expected = [8, 10, 12, 14, 16][rank - 1]
      const engine = setupStellarSymphony(rank)
      engine.onEvent({
        kind: "skillCast",
        characterId: 20,
        skillCategory: "Resonance Liberation",
        frame: 0,
      })
      expect(engine.getResource(20).concerto).toBe(expected)
    },
  )

  it("concerto cooldown: second Liberation within 20s does not restore again", () => {
    const engine = setupStellarSymphony(1)
    engine.onEvent({
      kind: "skillCast",
      characterId: 20,
      skillCategory: "Resonance Liberation",
      frame: 0,
    })
    const afterFirst = engine.getResource(20).concerto
    engine.onEvent({
      kind: "skillCast",
      characterId: 20,
      skillCategory: "Resonance Liberation",
      frame: 10 * FPS - 1,
    })
    expect(engine.getResource(20).concerto).toBe(afterFirst)
  })

  it("rank 1: healLanded on Resonance Skill applies +14% ATK to team for 30s", () => {
    const engine = setupStellarSymphony(1)
    const baseAtkPct = engine.resolveStats(20).atkPct
    engine.recordHeal({
      kind: "healLanded",
      characterId: 20,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    expect(engine.activeBuffIds(20)).toContain(
      "weapon.stellar-symphony.heal-atk",
    )
    expect(engine.resolveStats(20).atkPct).toBeCloseTo(baseAtkPct + 0.14)
  })

  it("heal-atk buff expires after 30s", () => {
    const engine = setupStellarSymphony(1)
    const baseAtkPct = engine.resolveStats(20).atkPct
    engine.recordHeal({
      kind: "healLanded",
      characterId: 20,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    engine.tickToFrame(30 * FPS + 1)
    expect(engine.activeBuffIds(20)).not.toContain(
      "weapon.stellar-symphony.heal-atk",
    )
    expect(engine.resolveStats(20).atkPct).toBeCloseTo(baseAtkPct)
  })

  it("non-Resonance-Skill heal does not trigger heal-atk buff", () => {
    const engine = setupStellarSymphony(1)
    engine.recordHeal({
      kind: "healLanded",
      characterId: 20,
      skillCategory: "Resonance Liberation",
      frame: 0,
    })
    expect(engine.activeBuffIds(20)).not.toContain(
      "weapon.stellar-symphony.heal-atk",
    )
  })
})

describe("Fallacy of No Return echo — Echo Skill buffs", () => {
  function setupFallacy() {
    const char = baseChar({ id: 30 })
    testCharacters = [char]
    testEchoes = [fallacyOfNoReturn]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [30, null, null],
      loadouts: [
        { ...emptyLoadout, echoId: fallacyOfNoReturn.id },
        emptyLoadout,
        emptyLoadout,
      ],
    })
    return engine
  }

  it("Echo Skill cast applies +10% Energy Regen to self for 20s", () => {
    const engine = setupFallacy()
    const baseER = engine.resolveStats(30).energyRechargePct
    engine.onEvent({
      kind: "skillCast",
      characterId: 30,
      skillCategory: "Echo Skill",
      frame: 0,
    })
    expect(engine.activeBuffIds(30)).toContain(
      "echo.fallacy-of-no-return.energy-regen",
    )
    expect(engine.resolveStats(30).energyRechargePct).toBeCloseTo(baseER + 0.1)
  })

  it("Echo Skill cast applies +10% ATK to team for 20s", () => {
    const engine = setupFallacy()
    const baseAtkPct = engine.resolveStats(30).atkPct
    engine.onEvent({
      kind: "skillCast",
      characterId: 30,
      skillCategory: "Echo Skill",
      frame: 0,
    })
    expect(engine.activeBuffIds(30)).toContain("echo.fallacy-of-no-return.atk")
    expect(engine.resolveStats(30).atkPct).toBeCloseTo(baseAtkPct + 0.1)
  })

  it("buffs expire after 20s", () => {
    const FPS = 60
    const engine = setupFallacy()
    const baseER = engine.resolveStats(30).energyRechargePct
    engine.onEvent({
      kind: "skillCast",
      characterId: 30,
      skillCategory: "Echo Skill",
      frame: 0,
    })
    engine.tickToFrame(20 * FPS + 1)
    expect(engine.activeBuffIds(30)).not.toContain(
      "echo.fallacy-of-no-return.energy-regen",
    )
    expect(engine.resolveStats(30).energyRechargePct).toBeCloseTo(baseER)
  })
})
