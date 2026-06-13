import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { HitEvent, SustainEvent } from "#/types/simulation-log"
import { BuffEngine } from "#/lib/engine/buff-engine"
import {
  onEventResolved,
  pendingNextOnFieldCount,
} from "#/lib/engine/buff-engine.test-utils"
import { runSimulation } from "#/lib/simulation"
import { verina } from "./verina"

let testCharacters: EnrichedCharacter[] = []

/** Fresh per-test copy of Verina (the engine mutates characters in place). */
function makeVerinaChar(): EnrichedCharacter {
  return { ...verina }
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
  cost3Mains: ["elemDmg", "elemDmg"],
}

function makeEngine(sequence = 0) {
  const char = makeVerinaChar()
  testCharacters = [char]
  const engine = new BuffEngine()
  engine.bootstrap({
    slots: [1503, null, null],
    loadouts: [{ ...emptyLoadout, sequence }, emptyLoadout, emptyLoadout],
  })
  return engine
}

describe("Verina — Outro Blossom (amp all +15%)", () => {
  it("Outro Skill cast applies amp all +15% to team for 30s", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillCategory: "Outro Skill",
      frame: 0,
    })
    expect(engine.activeBuffIds(1503)).toContain("char.verina.blossom-amp")
    expect(engine.resolveStats(1503).allAmp).toBeCloseTo(0.15)
  })
})

describe("Verina — Gift of Nature (team ATK +20%)", () => {
  it.each([
    [
      "Forte Circuit (Starflower Blooms Heavy)",
      "Heavy Attack" as const,
      "char.verina.heavy-attack.starflower-blooms.heavy-attack-starflower-blooms::heavy-attack",
    ],
    [
      "Resonance Liberation (Arboreal Flourish)",
      "Resonance Liberation" as const,
      "char.verina.resonance-liberation.arboreal-flourish.cast::resonance-liberation",
    ],
    [
      "Outro Skill (Blossom)",
      "Outro Skill" as const,
      "char.verina.outro-skill.blossom.cast::outro-skill",
    ],
  ])(
    "%s cast grants team ATK +20% for 20s",
    (_label, skillCategory, stageId) => {
      const engine = makeEngine()
      const baseAtkPct = engine.resolveStats(1503).atkPct
      engine.onEvent({
        kind: "skillCast",
        characterId: 1503,
        skillCategory,
        stageId,
        frame: 0,
      })
      expect(engine.activeBuffIds(1503)).toContain("char.verina.gift-of-nature")
      expect(engine.resolveStats(1503).atkPct).toBeCloseTo(baseAtkPct + 0.2)
    },
  )
})

describe("Verina — S1 Moment of Emergence (HoT stub)", () => {
  it("fires on Outro Skill cast at sequence 1 (deferred as nextOnField)", () => {
    const engine = makeEngine(1)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillCategory: "Outro Skill",
      frame: 0,
    })
    expect(pendingNextOnFieldCount(engine)).toBeGreaterThan(0)
  })
})

describe("Verina — Forte grants via DamageEntry.forte", () => {
  function hitLanded(
    engine: ReturnType<typeof makeEngine>,
    stageId: string,
    hitIndex: number,
    frame: number,
    forte?: number,
  ) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1503,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      stageId,
      hitIndex,
      frame,
      energy: 0,
      concerto: 0,
      forte,
    })
  }

  it("Cultivation Stage 5 hitIndex 1 grants +1 forte", () => {
    const engine = makeEngine()
    expect(engine.getResource(1503).forte).toBe(0)
    hitLanded(
      engine,
      "char.verina.basic-attack.cultivation.stage-5::basic-attack",
      1,
      0,
      1,
    )
    expect(engine.getResource(1503).forte).toBe(1)
  })

  it("Cultivation Stage 5 hitIndex 2 does NOT grant forte (no forte on second hit)", () => {
    const engine = makeEngine()
    hitLanded(
      engine,
      "char.verina.basic-attack.cultivation.stage-5::basic-attack",
      2,
      0,
    )
    expect(engine.getResource(1503).forte).toBe(0)
  })

  it("forte caps at 4 across multiple qualifying hits", () => {
    const engine = makeEngine()
    hitLanded(
      engine,
      "char.verina.intro-skill.verdant-growth.cast::intro-skill",
      1,
      0,
      1,
    )
    for (let i = 1; i <= 5; i++) {
      hitLanded(
        engine,
        "char.verina.basic-attack.cultivation.stage-5::basic-attack",
        1,
        i,
        1,
      )
    }
    expect(engine.getResource(1503).forte).toBe(4)
  })
})

describe("Verina — S2 Sprouting Reflections (Concerto restore via hitLanded)", () => {
  function hitLanded(
    engine: ReturnType<typeof makeEngine>,
    hitIndex: number,
    frame: number,
  ) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1503,
      skillCategory: "Resonance Skill",
      dmgType: "Damage",
      stageId:
        "char.verina.resonance-skill.botany-experiment.cast::resonance-skill",
      hitIndex,
      frame,
      energy: 0,
      concerto: 0,
    })
  }

  it("Botany Experiment hitIndex 1 grants +10 Concerto at sequence 2", () => {
    const engine = makeEngine(2)
    hitLanded(engine, 1, 0)
    expect(engine.getResource(1503).concerto).toBe(10)
  })

  it("Botany Experiment 4 hits only grant 10 concerto total (not 40)", () => {
    const engine = makeEngine(2)
    for (let i = 1; i <= 4; i++) {
      hitLanded(engine, i, 0)
    }
    expect(engine.getResource(1503).concerto).toBe(10)
  })
})

describe("Verina — S3 The Choice to Flourish (healingBonus +12%)", () => {
  it("folds healingBonus +12% into base stats at bootstrap (sequence 3)", () => {
    const engine = makeEngine(3)
    expect(engine.resolveStats(1503).healingBonus).toBeCloseTo(0.12)
  })
})

describe("Verina — S4 Blossoming Embrace (team Spectro DMG +15%)", () => {
  it.each([
    [
      "Forte Circuit (Starflower Blooms Heavy)",
      "Heavy Attack" as const,
      "char.verina.heavy-attack.starflower-blooms.heavy-attack-starflower-blooms::heavy-attack",
    ],
    [
      "Resonance Liberation (Arboreal Flourish)",
      "Resonance Liberation" as const,
      "char.verina.resonance-liberation.arboreal-flourish.cast::resonance-liberation",
    ],
    [
      "Outro Skill (Blossom)",
      "Outro Skill" as const,
      "char.verina.outro-skill.blossom.cast::outro-skill",
    ],
  ])(
    "%s cast grants team Spectro DMG +15% for 24s (sequence 4)",
    (_label, skillCategory, stageId) => {
      const engine = makeEngine(4)
      const baseSpectro = engine.resolveStats(1503).elementBonus["Spectro"]
      engine.onEvent({
        kind: "skillCast",
        characterId: 1503,
        skillCategory,
        stageId,
        frame: 0,
      })
      expect(engine.activeBuffIds(1503)).toContain(
        "char.verina.s4-blossoming-embrace",
      )
      expect(engine.resolveStats(1503).elementBonus["Spectro"]).toBeCloseTo(
        baseSpectro + 0.15,
      )
    },
  )
})

describe("Verina — S6 Joyous Harvest (DMG + Coord. Attack)", () => {
  it("Heavy Attack Starflower Blooms applies +20% allDmgBonus (sequence 6)", () => {
    const engine = makeEngine(6)
    const baseBonus = engine.resolveStats(1503).allDmgBonus
    engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillCategory: "Heavy Attack",
      stageId:
        "char.verina.heavy-attack.starflower-blooms.heavy-attack-starflower-blooms::heavy-attack",
      frame: 0,
    })
    expect(engine.resolveStats(1503).allDmgBonus).toBeCloseTo(baseBonus + 0.2)
  })

  it("Starflower Blooms cast emits a synthetic Coordinated Attack hit (sequence 6)", () => {
    const engine = makeEngine(6)
    const result = onEventResolved(engine, {
      kind: "skillCast",
      characterId: 1503,
      skillCategory: "Heavy Attack",
      stageId:
        "char.verina.heavy-attack.starflower-blooms.heavy-attack-starflower-blooms::heavy-attack",
      frame: 0,
    })
    expect(result.syntheticEvents.length).toBeGreaterThan(0)
    const synthHit = result.syntheticEvents[0]
    expect(synthHit.synthetic).toBe(true)
    expect(synthHit.sourceBuffId).toBe("char.verina.s6-joyous-harvest-coord")
  })

  it("Coord. Attack not emitted at sequence 0", () => {
    const engine = makeEngine(0)
    const result = onEventResolved(engine, {
      kind: "skillCast",
      characterId: 1503,
      skillCategory: "Heavy Attack",
      stageId:
        "char.verina.heavy-attack.starflower-blooms.heavy-attack-starflower-blooms::heavy-attack",
      frame: 0,
    })
    expect(result.syntheticEvents).toHaveLength(0)
  })
})

describe("Verina — Starflower Blooms Forte consumption (#215)", () => {
  const STARFLOWER_STAGES = [
    "char.verina.heavy-attack.starflower-blooms.heavy-attack-starflower-blooms::heavy-attack",
    "char.verina.basic-attack.starflower-blooms.mid-air-attack-starflower-blooms-stage-1::basic-attack",
    "char.verina.basic-attack.starflower-blooms.mid-air-attack-starflower-blooms-stage-2::basic-attack",
    "char.verina.basic-attack.starflower-blooms.mid-air-attack-starflower-blooms-stage-3::basic-attack",
  ] as const

  function grantForte(engine: ReturnType<typeof makeEngine>, amount: number) {
    for (let i = 0; i < amount; i++) {
      engine.onEvent({
        kind: "hitLanded",
        characterId: 1503,
        skillCategory: "Basic Attack",
        dmgType: "Damage",
        stageId: "char.verina.basic-attack.cultivation.stage-5::basic-attack",
        hitIndex: 1,
        frame: i,
        energy: 0,
        concerto: 0,
        forte: 1,
      })
    }
  }

  function castStarflower(
    engine: ReturnType<typeof makeEngine>,
    stageId: (typeof STARFLOWER_STAGES)[number],
    frame: number,
  ) {
    return onEventResolved(engine, {
      kind: "skillCast",
      characterId: 1503,
      skillCategory: stageId.includes("::heavy-attack")
        ? "Heavy Attack"
        : "Basic Attack",
      stageId,
      frame,
    })
  }

  it("forte=1 → Heavy Starflower consumes forte, adds concerto, emits heal", () => {
    const engine = makeEngine()
    grantForte(engine, 1)
    expect(engine.getResource(1503).forte).toBe(1)
    const result = castStarflower(
      engine,
      "char.verina.heavy-attack.starflower-blooms.heavy-attack-starflower-blooms::heavy-attack",
      100,
    )
    expect(engine.getResource(1503).forte).toBe(0)
    expect(engine.getResource(1503).concerto).toBe(12)
    const healHit = result.syntheticEvents.find(
      (h) => h.sourceBuffId === "char.verina.starflower-consume",
    )
    expect(healHit).toBeDefined()
  })

  it("forte=0 → no consume, no concerto restore, no heal emit", () => {
    const engine = makeEngine()
    expect(engine.getResource(1503).forte).toBe(0)
    const result = castStarflower(
      engine,
      "char.verina.heavy-attack.starflower-blooms.heavy-attack-starflower-blooms::heavy-attack",
      0,
    )
    expect(engine.getResource(1503).forte).toBe(0)
    expect(engine.getResource(1503).concerto).toBe(0)
    const healHit = result.syntheticEvents.find(
      (h) => h.sourceBuffId === "char.verina.starflower-consume",
    )
    expect(healHit).toBeUndefined()
  })

  it("consume is atomic: forte, concerto, and heal all land or none do", () => {
    const engine = makeEngine()
    grantForte(engine, 1)
    const result = castStarflower(
      engine,
      "char.verina.heavy-attack.starflower-blooms.heavy-attack-starflower-blooms::heavy-attack",
      100,
    )
    expect(engine.getResource(1503).forte).toBe(0)
    expect(engine.getResource(1503).concerto).toBe(12)
    const healCount = result.syntheticEvents.filter(
      (h) => h.sourceBuffId === "char.verina.starflower-consume",
    ).length
    expect(healCount).toBe(1)
  })
})

describe("Verina — Arboreal Flourish Photosynthesis Mark + coord (#216)", () => {
  const TEAMMATE_ID = 9999

  function makeTwoCharEngine(sequence = 0) {
    const verinaChar = makeVerinaChar()
    const teammate: EnrichedCharacter = {
      id: TEAMMATE_ID,
      name: "Teammate",
      element: "Fusion",
      weaponType: "Sword",
      rarity: "5",
      maxEnergy: 100,
      stats: {
        base: { hp: 0, atk: 0, def: 0 },
        max: { hp: 0, atk: 1000, def: 0 },
      },
      template: { weapon: "", echo: "", echoSet: "" },
      skillTreeBonuses: [],
      buffs: [],
      skills: [],
    }
    testCharacters = [verinaChar, teammate]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1503, TEAMMATE_ID, null],
      loadouts: [{ ...emptyLoadout, sequence }, emptyLoadout, emptyLoadout],
    })
    return engine
  }

  function libHitLanded(
    engine: ReturnType<typeof makeTwoCharEngine>,
    frame: number,
  ) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1503,
      skillCategory: "Resonance Liberation",
      dmgType: "Damage",
      stageId:
        "char.verina.resonance-liberation.arboreal-flourish.cast::resonance-liberation",
      hitIndex: 1,
      frame,
      energy: 0,
      concerto: 0,
    })
  }

  function teammateHit(
    engine: ReturnType<typeof makeTwoCharEngine>,
    frame: number,
    synthetic = false,
  ) {
    return onEventResolved(engine, {
      kind: "hitLanded",
      characterId: TEAMMATE_ID,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame,
      energy: 0,
      concerto: 0,
      ...(synthetic ? { synthetic: true, sourceBuffId: "some.coord" } : {}),
    })
  }

  it("Liberation hitIndex 1 applies Photosynthesis Mark", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    expect(engine.activeBuffIds(1503)).toContain(
      "char.verina.photosynthesis-mark",
    )
  })

  it("teammate hit while mark is active fires coord (damage + heal)", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    const result = teammateHit(engine, 10)
    const dmgCoord = result.syntheticEvents.find(
      (h) =>
        h.sourceBuffId === "char.verina.mark-coord-reaction" &&
        h.kind === "hit",
    )
    const healCoord = result.syntheticEvents.find(
      (h) =>
        h.sourceBuffId === "char.verina.mark-coord-reaction" &&
        h.kind === "sustain",
    )
    expect(dmgCoord).toBeDefined()
    expect(healCoord).toBeDefined()
  })

  it("no coord fires before Liberation — mark not yet active", () => {
    const engine = makeTwoCharEngine()
    const result = teammateHit(engine, 0)
    expect(
      result.syntheticEvents.filter(
        (h) => h.sourceBuffId === "char.verina.mark-coord-reaction",
      ),
    ).toHaveLength(0)
  })

  it("synthetic hits do NOT trigger coord — no coord→coord chain", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    const result = teammateHit(engine, 10, true)
    expect(
      result.syntheticEvents.filter(
        (h) => h.sourceBuffId === "char.verina.mark-coord-reaction",
      ),
    ).toHaveLength(0)
  })

  it("two teammate hits within 60 frames produce exactly one coord pair (ICD)", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    const r1 = teammateHit(engine, 10)
    const r2 = teammateHit(engine, 30)
    const coordsR1 = r1.syntheticEvents.filter(
      (h) => h.sourceBuffId === "char.verina.mark-coord-reaction",
    ).length
    const coordsR2 = r2.syntheticEvents.filter(
      (h) => h.sourceBuffId === "char.verina.mark-coord-reaction",
    ).length
    expect(coordsR1).toBe(2)
    expect(coordsR2).toBe(0)
  })

  it("coord fires again after ICD window (60 frames)", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    teammateHit(engine, 10)
    const r2 = teammateHit(engine, 71)
    expect(
      r2.syntheticEvents.filter(
        (h) => h.sourceBuffId === "char.verina.mark-coord-reaction",
      ).length,
    ).toBe(2)
  })

  it("no coord fires after mark expires (12s = 720 frames)", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    engine.tickToFrame(721)
    const result = teammateHit(engine, 721)
    expect(
      result.syntheticEvents.filter(
        (h) => h.sourceBuffId === "char.verina.mark-coord-reaction",
      ),
    ).toHaveLength(0)
  })

  it("coord acting character is Verina even for teammate hit", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    const result = teammateHit(engine, 10)
    const coord = result.syntheticEvents.find(
      (h) => h.sourceBuffId === "char.verina.mark-coord-reaction",
    )
    expect(coord?.characterId).toBe(1503)
  })

  it("S6 joyous-harvest-coord still fires independently when mark is active (sequence 6)", () => {
    const engine = makeTwoCharEngine(6)
    libHitLanded(engine, 0)
    const result = onEventResolved(engine, {
      kind: "skillCast",
      characterId: 1503,
      skillCategory: "Heavy Attack",
      stageId:
        "char.verina.heavy-attack.starflower-blooms.heavy-attack-starflower-blooms::heavy-attack",
      frame: 100,
    })
    const s6Coord = result.syntheticEvents.find(
      (h) => h.sourceBuffId === "char.verina.s6-joyous-harvest-coord",
    )
    expect(s6Coord).toBeDefined()
  })
})

describe("Verina — Arboreal Flourish + teammate combo, end-to-end (#216)", () => {
  const TEAMMATE_ID = 9999
  const COORD_ID = "char.verina.mark-coord-reaction"

  const makeTeammate = (): EnrichedCharacter => ({
    id: TEAMMATE_ID,
    name: "Teammate",
    element: "Fusion",
    weaponType: "Sword",
    rarity: "5",
    maxEnergy: 100,
    stats: {
      base: { hp: 0, atk: 0, def: 0 },
      max: { hp: 0, atk: 1000, def: 0 },
    },
    template: { weapon: "", echo: "", echoSet: "" },
    skillTreeBonuses: [],
    buffs: [],
    skills: [
      {
        id: 1,
        name: "Normal Attack",
        type: "Normal Attack",
        stages: (["S1", "S2", "S3"] as const).map((label) => ({
          name: label,
          newName: label,
          category: "Basic Attack" as const,
          value: label,
          actionTime: 62,
          damage: [
            {
              type: "Basic Attack" as const,
              dmgType: "Fusion",
              scalingStat: "atk",
              actionFrame: 15,
              value: 1.0,
              energy: 0,
              concerto: 0,
              toughness: 0,
              weakness: 0,
            },
          ],
        })),
        damage: [],
      },
    ],
  })

  it("teammate basic combo during 12s mark window triggers coord pairs (damage + heal) at ≈1s cadence", () => {
    const verinaChar = makeVerinaChar()
    testCharacters = [verinaChar, makeTeammate()]
    const slots: Slots = [1503, TEAMMATE_ID, null]
    const loadouts: SlotLoadout[] = [
      { ...emptyLoadout },
      { ...emptyLoadout },
      { ...emptyLoadout },
    ]

    const combo = ["S1", "S2", "S3"] as const
    const timeline: TimelineEntry[] = [
      {
        id: "lib",
        characterId: 1503,
        stageId:
          "char.verina.resonance-liberation.arboreal-flourish.cast::resonance-liberation",
      },
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `na-${i}`,
        characterId: TEAMMATE_ID,
        stageId: `char.teammate.basic-attack.normal-attack.${combo[i % 3].toLowerCase()}::basic-attack`,
      })),
    ]

    const log = runSimulation(timeline, slots, loadouts)

    const coordDamage = log.filter(
      (e): e is HitEvent =>
        e.kind === "hit" && e.coord === true && e.sourceBuffId === COORD_ID,
    )
    const coordHeal = log.filter(
      (e): e is SustainEvent =>
        e.kind === "sustain" && e.coord === true && e.sourceBuffId === COORD_ID,
    )

    // Damage + heal fire as a pair per trigger.
    expect(coordDamage.length).toBeGreaterThanOrEqual(10)
    expect(coordHeal.length).toBe(coordDamage.length)
    coordDamage.forEach((dmg, i) => {
      expect(coordHeal[i].frame).toBe(dmg.frame)
    })

    // ICD respected: consecutive coords are > 60 frames apart.
    for (let i = 1; i < coordDamage.length; i++) {
      const gap = coordDamage[i].frame - coordDamage[i - 1].frame
      expect(gap).toBeGreaterThan(60)
    }

    // No coord lands after the 12s (720f) mark window.
    coordDamage.forEach((h) => expect(h.frame).toBeLessThan(720))

    // Acting Character on every coord is Verina (not the teammate that triggered it).
    coordDamage.forEach((h) => expect(h.characterId).toBe(1503))
    coordHeal.forEach((h) => expect(h.characterId).toBe(1503))
  })
})

describe("Verina — Skill.concerto grants on cast (via 'Skill DMG' stage)", () => {
  function runSingleCast(stageId: string) {
    const char = makeVerinaChar()
    testCharacters = [char]
    const slots: Slots = [1503, null, null]
    const loadouts: SlotLoadout[] = [emptyLoadout, emptyLoadout, emptyLoadout]
    const entry: TimelineEntry = { id: "t1", characterId: 1503, stageId }
    return runSimulation([entry], slots, loadouts)
  }

  it("Resonance Skill cast grants +30 concerto", () => {
    const log = runSingleCast(
      "char.verina.resonance-skill.botany-experiment.cast::resonance-skill",
    )
    const action = log.find((e) => e.kind === "action")
    expect(action?.cumulativeConcerto).toBe(30)
  })

  it("Liberation cast grants +20 concerto", () => {
    const log = runSingleCast(
      "char.verina.resonance-liberation.arboreal-flourish.cast::resonance-liberation",
    )
    const action = log.find((e) => e.kind === "action")
    expect(action?.cumulativeConcerto).toBe(20)
  })

  it("Intro Skill cast grants +10 concerto", () => {
    const log = runSingleCast(
      "char.verina.intro-skill.verdant-growth.cast::intro-skill",
    )
    const action = log.find((e) => e.kind === "action")
    expect(action?.cumulativeConcerto).toBe(10)
  })
})
