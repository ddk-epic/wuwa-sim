import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { HitContext } from "#/types/buff"
import type { SlotLoadout } from "#/types/loadout"
import { BuffEngine } from "#/lib/engine/buff-engine"
import { camellya } from "./camellya"

let testCharacters: EnrichedCharacter[] = []

/** Fresh per-test copy of Camellya (the engine mutates characters in place). */
function makeCamellyaChar(): EnrichedCharacter {
  return { ...camellya }
}

vi.mock("../../lib/loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getWeaponById: () => null,
  getEchoById: () => null,
  getEchoSetById: () => null,
}))

afterEach(() => {
  testCharacters = []
})

const emptyLoadout: SlotLoadout = {
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
  echoBuild: "4-3-3-1-1",
  cost4Mains: ["cd"],
  // No `elemDmg` mains so the only Havoc DMG Bonus comes from Seedbed.
  cost3Mains: ["er", "er"],
}

const CAMELLYA = 1603

function makeEngine(sequence = 0) {
  testCharacters = [makeCamellyaChar()]
  const engine = new BuffEngine()
  engine.bootstrap({
    slots: [CAMELLYA, null, null],
    loadouts: [{ ...emptyLoadout, sequence }, emptyLoadout, emptyLoadout],
  })
  return engine
}

const EPHEMERAL_STAGE =
  "char.camellya.resonance-skill.vegetative-universe.ephemeral::basic-attack"
const EPHEMERAL_HIT: HitContext = {
  stageId: `${EPHEMERAL_STAGE}.1`,
  skillCategory: "Resonance Skill",
  skillType: "Basic Attack",
  element: "Havoc",
}
const FERVOR_HIT: HitContext = {
  stageId:
    "char.camellya.resonance-liberation.fervor-efflorescent._::resonance-liberation.1",
  skillCategory: "Resonance Liberation",
  skillType: "Resonance Liberation",
  element: "Havoc",
}
const INTRO_HIT: HitContext = {
  stageId: "char.camellya.intro-skill.everblooming._::intro-skill.1",
  skillCategory: "Intro Skill",
  skillType: "Intro Skill",
  element: "Havoc",
}
const OUTRO_HIT: HitContext = {
  stageId: "char.camellya.outro-skill.twining._::outro-skill.1",
  skillCategory: "Outro Skill",
  skillType: "Outro Skill",
  element: "Havoc",
}

describe("Camellya — Seedbed / Epiphyte passives (folded at bootstrap)", () => {
  it("Seedbed: Havoc DMG Bonus +15%", () => {
    const engine = makeEngine()
    expect(engine.resolveStats(CAMELLYA).elementBonus["Havoc"]).toBeCloseTo(
      0.15,
    )
  })

  it("Epiphyte: Basic Attack DMG Bonus +15%", () => {
    const engine = makeEngine()
    expect(
      engine.resolveStats(CAMELLYA).skillTypeBonus["Basic Attack"],
    ).toBeCloseTo(0.15)
  })

  it("Seedbed retags Heavy Pruning hits as Basic Attack while keeping Heavy Attack category", () => {
    const burgeoning = camellya.skills.find((s) => s.name === "Burgeoning")
    const heavy = burgeoning?.stages.find((s) => s.category === "Heavy Attack")
    expect(heavy).toBeDefined()
    expect(heavy?.damage.length).toBeGreaterThan(0)
    for (const entry of heavy?.damage ?? []) {
      expect(entry.type).toBe("Basic Attack")
    }
  })
})

describe("Camellya — S1 Intro Crit DMG +28%", () => {
  it("Intro cast grants Crit DMG +28% (sequence 1)", () => {
    const engine = makeEngine(1)
    const base = engine.resolveStats(CAMELLYA).critDmg
    engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      skillCategory: "Intro Skill",
      frame: 0,
    })
    expect(engine.resolveStats(CAMELLYA).critDmg).toBeCloseTo(base + 0.28)
  })

  it("does not apply below sequence 1", () => {
    const engine = makeEngine(0)
    const base = engine.resolveStats(CAMELLYA).critDmg
    engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      skillCategory: "Intro Skill",
      frame: 0,
    })
    expect(engine.resolveStats(CAMELLYA).critDmg).toBeCloseTo(base)
  })
})

describe("Camellya — S4 Intro team Basic Attack DMG +25%", () => {
  it("Intro cast grants Basic Attack DMG +25% on top of Epiphyte (sequence 4)", () => {
    const engine = makeEngine(4)
    expect(
      engine.resolveStats(CAMELLYA).skillTypeBonus["Basic Attack"],
    ).toBeCloseTo(0.15)
    engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      skillCategory: "Intro Skill",
      frame: 0,
    })
    expect(
      engine.resolveStats(CAMELLYA).skillTypeBonus["Basic Attack"],
    ).toBeCloseTo(0.15 + 0.25)
  })
})

describe("Camellya — Ephemeral 70-concerto spend", () => {
  function grantConcerto(engine: ReturnType<typeof makeEngine>, n: number) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: n,
    })
  }

  it("concerto ≥ 70 → Ephemeral cast spends 70", () => {
    const engine = makeEngine()
    grantConcerto(engine, 70)
    expect(engine.getResource(CAMELLYA).concerto).toBe(70)
    engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      stageId: EPHEMERAL_STAGE,
      skillCategory: "Resonance Skill",
      frame: 1,
    })
    expect(engine.getResource(CAMELLYA).concerto).toBe(0)
  })

  it("concerto < 70 → Ephemeral cast does not spend", () => {
    const engine = makeEngine()
    grantConcerto(engine, 50)
    engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      stageId: EPHEMERAL_STAGE,
      skillCategory: "Resonance Skill",
      frame: 1,
    })
    expect(engine.getResource(CAMELLYA).concerto).toBe(50)
  })
})

describe("Camellya — bonusMultiplier scoped via appliesToHits", () => {
  it("S2: Ephemeral hits gain +120% bonus multiplier (sequence 2)", () => {
    const engine = makeEngine(2)
    expect(
      engine.resolveStats(CAMELLYA, EPHEMERAL_HIT).bonusMultiplier,
    ).toBeCloseTo(1.2)
    // Hit-agnostic pass must NOT fold the appliesToHits multiplier.
    expect(engine.resolveStats(CAMELLYA).bonusMultiplier).toBeCloseTo(0)
    // Non-Ephemeral hits are unaffected.
    expect(
      engine.resolveStats(CAMELLYA, FERVOR_HIT).bonusMultiplier,
    ).toBeCloseTo(0)
  })

  it("S2 does not apply below sequence 2", () => {
    const engine = makeEngine(1)
    expect(
      engine.resolveStats(CAMELLYA, EPHEMERAL_HIT).bonusMultiplier,
    ).toBeCloseTo(0)
  })

  it("S3 Fervor half: Fervor hits gain +50% bonus multiplier (sequence 3)", () => {
    const engine = makeEngine(3)
    expect(
      engine.resolveStats(CAMELLYA, FERVOR_HIT).bonusMultiplier,
    ).toBeCloseTo(0.5)
    expect(engine.resolveStats(CAMELLYA).bonusMultiplier).toBeCloseTo(0)
  })

  it("S5: Intro +303% and Outro +68% bonus multiplier (sequence 5)", () => {
    const engine = makeEngine(5)
    expect(
      engine.resolveStats(CAMELLYA, INTRO_HIT).bonusMultiplier,
    ).toBeCloseTo(3.03)
    expect(
      engine.resolveStats(CAMELLYA, OUTRO_HIT).bonusMultiplier,
    ).toBeCloseTo(0.68)
    expect(engine.resolveStats(CAMELLYA).bonusMultiplier).toBeCloseTo(0)
  })

  it("S5 does not apply below sequence 5", () => {
    const engine = makeEngine(4)
    expect(
      engine.resolveStats(CAMELLYA, INTRO_HIT).bonusMultiplier,
    ).toBeCloseTo(0)
  })
})

describe("Camellya — pistil drain mints Crimson Buds (resourceStep, ADR-0032)", () => {
  const BUD = "char.camellya.forte.crimson-bud"

  /** A consuming hit: drains `forte` raw and grants the per-hit API concerto. */
  function consumeForte(
    engine: ReturnType<typeof makeEngine>,
    forte: number,
    frame: number,
    concerto = 0,
  ) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      stageId:
        "char.camellya.basic-attack.burgeoning.basic-attack-1::basic-attack.1",
      frame,
      energy: 0,
      concerto,
      forte,
    })
  }

  /** Intro Everblooming refill: positive forte, FR-scaled then capped at 100. */
  function refillForte(engine: ReturnType<typeof makeEngine>, frame: number) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Intro Skill",
      dmgType: "Damage",
      stageId: "char.camellya.intro-skill.everblooming._::intro-skill.1",
      frame,
      energy: 0,
      concerto: 0,
      forte: 100,
    })
  }

  function budStacks(engine: ReturnType<typeof makeEngine>): number {
    return engine.activeBuffs(CAMELLYA).find((b) => b.id === BUD)?.stacks ?? 0
  }

  it("refills forte to 100 (capped) on Everblooming", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    expect(engine.getResource(CAMELLYA).forte).toBe(100)
  })

  it("negative forte drains the ledger raw (not FR-scaled) and floors at 0", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    consumeForte(engine, -30, 1)
    expect(engine.getResource(CAMELLYA).forte).toBeCloseTo(70)
    consumeForte(engine, -999, 2)
    expect(engine.getResource(CAMELLYA).forte).toBe(0)
  })

  it("each 10 forte consumed mints one Crimson Bud", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    consumeForte(engine, -10, 1)
    expect(budStacks(engine)).toBe(1)
    consumeForte(engine, -25, 2)
    // 100 → 90 → 65 crosses 90, then 80, 70 — total 3 buds.
    expect(budStacks(engine)).toBe(3)
  })

  it("draining a full 100 forte yields 10 Crimson Buds (capped at 10)", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    consumeForte(engine, -100, 1)
    expect(budStacks(engine)).toBe(10)
  })

  it("does not exceed the 10-stack cap even with a second refill+drain", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    consumeForte(engine, -100, 1)
    refillForte(engine, 2)
    consumeForte(engine, -100, 3)
    expect(budStacks(engine)).toBe(10)
  })

  it("the conversion leaves concerto untouched — buds are minted, not concerto", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    // A consuming hit carries its own API concerto (5) and drains 30 forte.
    consumeForte(engine, -30, 1, 5)
    // Exactly the per-hit concerto — resourceStep adds no extra +4/bud.
    expect(engine.getResource(CAMELLYA).concerto).toBe(5)
    expect(budStacks(engine)).toBe(3)
  })

  it("refills (gains) never mint buds", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    expect(budStacks(engine)).toBe(0)
  })
})
