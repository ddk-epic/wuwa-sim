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
  stageId: EPHEMERAL_STAGE,
  skill: "vegetative-universe",
  hitIndex: 1,
  skillCategory: "Resonance Skill",
  skillType: "Basic Attack",
  element: "Havoc",
}
const FERVOR_HIT: HitContext = {
  stageId:
    "char.camellya.resonance-liberation.fervor-efflorescent.cast::resonance-liberation",
  skill: "fervor-efflorescent",
  hitIndex: 1,
  skillCategory: "Resonance Liberation",
  skillType: "Resonance Liberation",
  element: "Havoc",
}
const INTRO_HIT: HitContext = {
  stageId: "char.camellya.intro-skill.everblooming.cast::intro-skill",
  skill: "everblooming",
  hitIndex: 1,
  skillCategory: "Intro Skill",
  skillType: "Intro Skill",
  element: "Havoc",
}
const OUTRO_HIT: HitContext = {
  stageId: "char.camellya.outro-skill.twining.cast::outro-skill",
  skill: "twining",
  hitIndex: 1,
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

describe("Camellya — Ephemeral concerto cost (on the hit)", () => {
  const ephemeralCost = camellya.skills.find((s) => s.type === "Forte Circuit")!
    .stages[0].damage[0].concerto

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

  function landEphemeral(engine: ReturnType<typeof makeEngine>) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Resonance Skill",
      dmgType: "Damage",
      frame: 1,
      concerto: ephemeralCost,
    })
  }

  it("the Ephemeral hit carries a −70 concerto cost", () => {
    expect(ephemeralCost).toBe(-70)
  })

  it("consumes 70 concerto", () => {
    const engine = makeEngine()
    grantConcerto(engine, 70)
    landEphemeral(engine)
    expect(engine.getResource(CAMELLYA).concerto).toBe(0)
  })

  it("floors at 0 when below the cost", () => {
    const engine = makeEngine()
    grantConcerto(engine, 50)
    landEphemeral(engine)
    expect(engine.getResource(CAMELLYA).concerto).toBe(0)
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

describe("Camellya — pistil drain mints Crimson Buds (resourceStep)", () => {
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
        "char.camellya.basic-attack.burgeoning.basic-attack-1::basic-attack",
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
      stageId: "char.camellya.intro-skill.everblooming.cast::intro-skill",
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

describe("Camellya — Budding Mode + Sweet Dream (scaledByStacks)", () => {
  const BUDDING = "char.camellya.forte.budding-mode"
  const BUD = "char.camellya.forte.crimson-bud"

  const CORE_HIT: HitContext = {
    stageId:
      "char.camellya.basic-attack.burgeoning.basic-attack-1::basic-attack",
    skill: "burgeoning",
    hitIndex: 1,
    skillCategory: "Basic Attack",
    skillType: "Basic Attack",
    element: "Havoc",
  }
  const CRIMSON_BLOSSOM_HIT: HitContext = {
    stageId:
      "char.camellya.resonance-skill.valse-of-bloom-and-blight.crimson-blossom::basic-attack",
    skill: "valse-of-bloom-and-blight",
    hitIndex: 2,
    skillCategory: "Resonance Skill",
    skillType: "Basic Attack",
    element: "Havoc",
  }

  /** Refill to 100, then drain enough forte to mint exactly `buds` Crimson Buds. */
  function mintBuds(engine: ReturnType<typeof makeEngine>, buds: number) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Intro Skill",
      dmgType: "Damage",
      stageId: "char.camellya.intro-skill.everblooming.cast::intro-skill",
      frame: 0,
      forte: 100,
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      stageId:
        "char.camellya.basic-attack.burgeoning.basic-attack-1::basic-attack",
      frame: 1,
      forte: -10 * buds,
    })
  }

  function castEphemeral(engine: ReturnType<typeof makeEngine>, frame: number) {
    engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      stageId: EPHEMERAL_STAGE,
      skillCategory: "Resonance Skill",
      frame,
    })
  }

  function buddingActive(engine: ReturnType<typeof makeEngine>): boolean {
    return engine.activeBuffIds(CAMELLYA).includes(BUDDING)
  }
  function budStacks(engine: ReturnType<typeof makeEngine>): number {
    return engine.activeBuffs(CAMELLYA).find((b) => b.id === BUD)?.stacks ?? 0
  }

  it("casting Ephemeral with N buds → core attacks gain 0.5 + 0.05×N (snapshot)", () => {
    const engine = makeEngine()
    mintBuds(engine, 3)
    expect(budStacks(engine)).toBe(3)
    castEphemeral(engine, 2)
    // Sweet Dream = 0.5 + 0.05 × 3 = 0.65 on core attacks.
    expect(engine.resolveStats(CAMELLYA, CORE_HIT).bonusMultiplier).toBeCloseTo(
      0.65,
    )
    expect(
      engine.resolveStats(CAMELLYA, CRIMSON_BLOSSOM_HIT).bonusMultiplier,
    ).toBeCloseTo(0.65)
  })

  it("buds are consumed on cast but the snapshotted Sweet Dream persists", () => {
    const engine = makeEngine()
    mintBuds(engine, 4)
    castEphemeral(engine, 2)
    // Buds gone…
    expect(budStacks(engine)).toBe(0)
    // …but Sweet Dream still reads the frozen 0.5 + 0.05 × 4 = 0.70.
    expect(engine.resolveStats(CAMELLYA, CORE_HIT).bonusMultiplier).toBeCloseTo(
      0.7,
    )
  })

  it("Sweet Dream does not apply to Ephemeral itself or non-core hits", () => {
    const engine = makeEngine()
    mintBuds(engine, 3)
    castEphemeral(engine, 2)
    // Ephemeral and Fervor hits are not core attacks — no Sweet Dream.
    expect(
      engine.resolveStats(CAMELLYA, EPHEMERAL_HIT).bonusMultiplier,
    ).toBeCloseTo(0)
    expect(
      engine.resolveStats(CAMELLYA, FERVOR_HIT).bonusMultiplier,
    ).toBeCloseTo(0)
    // Hit-agnostic pass never folds the appliesToHits multiplier.
    expect(engine.resolveStats(CAMELLYA).bonusMultiplier).toBeCloseTo(0)
  })

  it("Budding Mode ends on swap-out", () => {
    const engine = makeEngine()
    mintBuds(engine, 2)
    castEphemeral(engine, 2)
    expect(buddingActive(engine)).toBe(true)
    engine.onEvent({ kind: "swapOut", characterId: CAMELLYA, frame: 3 })
    expect(buddingActive(engine)).toBe(false)
    expect(engine.resolveStats(CAMELLYA, CORE_HIT).bonusMultiplier).toBeCloseTo(
      0,
    )
  })

  it("Budding Mode ends when Crimson Pistils reach 0", () => {
    const engine = makeEngine()
    mintBuds(engine, 3) // forte at 70 after draining 30
    castEphemeral(engine, 2)
    expect(buddingActive(engine)).toBe(true)
    // Drain the remaining 70 forte to 0 → pistil-zero exit.
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      stageId:
        "char.camellya.basic-attack.burgeoning.basic-attack-1::basic-attack",
      frame: 3,
      forte: -70,
    })
    expect(engine.getResource(CAMELLYA).forte).toBe(0)
    expect(buddingActive(engine)).toBe(false)
  })

  it("S3: ATK +58% only while Budding Mode is active (sequence 3)", () => {
    const engine = makeEngine(3)
    const before = engine.resolveStats(CAMELLYA).atkPct
    mintBuds(engine, 2)
    castEphemeral(engine, 2)
    expect(engine.resolveStats(CAMELLYA).atkPct).toBeCloseTo(before + 0.58)
    engine.onEvent({ kind: "swapOut", characterId: CAMELLYA, frame: 3 })
    expect(engine.resolveStats(CAMELLYA).atkPct).toBeCloseTo(before)
  })

  it("S6: adds +1.5 to the Sweet Dream multiplier at sequence 6", () => {
    const engine = makeEngine(6)
    mintBuds(engine, 3)
    castEphemeral(engine, 2)
    // 0.65 (Sweet Dream) + 1.5 (S6 rider) = 2.15 on core attacks.
    expect(engine.resolveStats(CAMELLYA, CORE_HIT).bonusMultiplier).toBeCloseTo(
      2.15,
    )
  })

  it("does not enter Budding Mode below the Ephemeral cast", () => {
    const engine = makeEngine()
    mintBuds(engine, 3)
    expect(buddingActive(engine)).toBe(false)
    // Buds remain unconsumed until Ephemeral is cast.
    expect(budStacks(engine)).toBe(3)
  })

  // Pins the skill-axis scope: the Sweet Dream recipients are declared per
  // skill, so the whole Normal Attack group — including stages omitted from
  // the old explicit tuple (Heavy Pruning, Mid-air, Dodge Counter, Atonement)
  // — gains Sweet Dream, while Ephemeral (a sibling Resonance Skill under
  // vegetative-universe) stays excluded.
  it("Sweet Dream covers the whole Normal Attack group via the skill axis", () => {
    const hit = (skill: string, stageId: string): HitContext => ({
      stageId,
      skill,
      skillCategory: "Basic Attack",
      skillType: "Basic Attack",
      element: "Havoc",
    })
    const covered: [string, string][] = [
      [
        "burgeoning",
        "char.camellya.basic-attack.burgeoning.mid-air-attack::basic-attack",
      ],
      [
        "burgeoning",
        "char.camellya.basic-attack.burgeoning.dodge-counter::basic-attack",
      ],
      [
        "burgeoning",
        "char.camellya.basic-attack.burgeoning.atonement::basic-attack",
      ],
      [
        "burgeoning",
        "char.camellya.basic-attack.burgeoning.blazing-waltz::basic-attack",
      ],
      [
        "burgeoning",
        "char.camellya.basic-attack.burgeoning.vining-ronde::basic-attack",
      ],
      [
        "burgeoning",
        "char.camellya.heavy-attack.burgeoning.heavy-attack::basic-attack",
      ],
      [
        "valse-of-bloom-and-blight",
        "char.camellya.resonance-skill.valse-of-bloom-and-blight.floral-ravage::basic-attack",
      ],
    ]
    const engine = makeEngine()
    mintBuds(engine, 3)
    castEphemeral(engine, 2)
    for (const [skill, stageId] of covered) {
      expect(
        engine.resolveStats(CAMELLYA, hit(skill, stageId)).bonusMultiplier,
      ).toBeCloseTo(0.65)
    }
    // Ephemeral shares the "Basic Attack" hit type but belongs to a different
    // skill — it must not be swept in by the skill axis.
    expect(
      engine.resolveStats(CAMELLYA, EPHEMERAL_HIT).bonusMultiplier,
    ).toBeCloseTo(0)
  })
})

describe("Camellya — Budding-mode suppressions (hit-scoped ERM + bud gate)", () => {
  const BUD = "char.camellya.forte.crimson-bud"
  const BASIC_STAGE =
    "char.camellya.basic-attack.burgeoning.basic-attack-1::basic-attack"

  function refillForte(engine: ReturnType<typeof makeEngine>, frame: number) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Intro Skill",
      dmgType: "Damage",
      stageId: "char.camellya.intro-skill.everblooming.cast::intro-skill",
      frame,
      forte: 100,
    })
  }

  /** Fire a hit carrying `energy`; `forte < 0` marks it a consuming attack. */
  function hit(
    engine: ReturnType<typeof makeEngine>,
    frame: number,
    energy: number,
    forte?: number,
  ) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      stageId: BASIC_STAGE,
      frame,
      energy,
      forte,
    })
  }

  function castEphemeral(engine: ReturnType<typeof makeEngine>, frame: number) {
    engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      stageId: EPHEMERAL_STAGE,
      skillCategory: "Resonance Skill",
      frame,
    })
  }

  function budStacks(engine: ReturnType<typeof makeEngine>): number {
    return engine.activeBuffs(CAMELLYA).find((b) => b.id === BUD)?.stacks ?? 0
  }

  it("consuming attacks generate 2.5× energy outside Budding Mode", () => {
    const engine = makeEngine()
    const er = engine.resolveStats(CAMELLYA).energyRechargePct
    hit(engine, 0, 10, -5)
    // +150% ERM → energy × (1 + ER) × 2.5.
    expect(engine.getResource(CAMELLYA).energy).toBeCloseTo(10 * (1 + er) * 2.5)
  })

  it("non-consuming hits are unaffected — ER only, no ERM", () => {
    const engine = makeEngine()
    const er = engine.resolveStats(CAMELLYA).energyRechargePct
    // forte undefined → not a consuming attack → ERM does not land.
    hit(engine, 0, 10)
    expect(engine.getResource(CAMELLYA).energy).toBeCloseTo(10 * (1 + er))
  })

  it("consuming attacks generate 0 energy inside Budding Mode", () => {
    const engine = makeEngine()
    refillForte(engine, 0) // forte 100, mints 0 buds
    castEphemeral(engine, 1) // enter Budding Mode (forte still 100)
    const before = engine.getResource(CAMELLYA).energy
    hit(engine, 2, 10, -5) // consuming; forte 100 → 95, Budding stays
    // Budding ERM (−1.0) cancels the base → factor 0 → no energy gained.
    expect(engine.getResource(CAMELLYA).energy).toBeCloseTo(before)
  })

  it("no Crimson Buds are minted while Budding Mode is active, though forte still drains", () => {
    const engine = makeEngine()
    refillForte(engine, 0) // forte 100
    castEphemeral(engine, 1) // enter Budding (consumes the 0 buds)
    expect(budStacks(engine)).toBe(0)
    hit(engine, 2, 0, -30) // drains 30 forte inside Budding
    // Forte fell 100 → 70 (would mint 3 buds), but the gate suppresses minting.
    expect(engine.getResource(CAMELLYA).forte).toBeCloseTo(70)
    expect(budStacks(engine)).toBe(0)
  })

  it("bud minting resumes once Budding Mode ends", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    castEphemeral(engine, 1)
    engine.onEvent({ kind: "swapOut", characterId: CAMELLYA, frame: 2 })
    // Budding over → the gate opens; draining 20 forte mints 2 buds.
    hit(engine, 3, 0, -20)
    expect(budStacks(engine)).toBe(2)
  })
})
