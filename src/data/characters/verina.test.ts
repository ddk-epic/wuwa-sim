import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { HitEvent, SustainEvent } from "#/types/simulation-log"
import { BuffEngine } from "#/lib/engine/buff-engine"
import { pendingNextOnFieldCount } from "#/lib/engine/buff-engine.test-utils"
import { runSimulation } from "#/lib/simulation"
import { verina } from "./verina"

let testCharacters: EnrichedCharacter[] = []

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
  const char = {
    ...verina,
    buffs: verina.buffs,
  } as unknown as EnrichedCharacter
  testCharacters = [char]
  const engine = new BuffEngine()
  engine.bootstrap({
    slots: [1503, null, null],
    loadouts: [{ ...emptyLoadout, sequence }, emptyLoadout, emptyLoadout],
  })
  return engine
}

describe("Verina — Outro Blossom (deepen all +15%)", () => {
  it("Outro Skill cast applies deepen all +15% to team for 30s", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Outro Skill",
      frame: 0,
    })
    expect(engine.activeBuffIds(1503)).toContain(
      "char.verina.outro.blossom-deepen",
    )
    expect(engine.resolveStats(1503).allDeepen).toBeCloseTo(0.15)
  })

  it("buff expires after 30s (1800 frames)", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Outro Skill",
      frame: 0,
    })
    engine.tickToFrame(30 * 60)
    expect(engine.activeBuffIds(1503)).not.toContain(
      "char.verina.outro.blossom-deepen",
    )
  })
})

describe("Verina — Gift of Nature (team ATK +20%)", () => {
  it.each(["Forte Circuit", "Resonance Liberation", "Outro Skill"] as const)(
    "%s cast grants team ATK +20% for 20s",
    (skillType) => {
      const engine = makeEngine()
      const baseAtkPct = engine.resolveStats(1503).atkPct
      engine.onEvent({
        kind: "skillCast",
        characterId: 1503,
        skillType,
        frame: 0,
      })
      expect(engine.activeBuffIds(1503)).toContain(
        "char.verina.inherent.gift-of-nature",
      )
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
      skillType: "Outro Skill",
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
      skillType: "Basic Attack",
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
    hitLanded(engine, "Cultivation::Stage 5", 1, 0, 1)
    expect(engine.getResource(1503).forte).toBe(1)
  })

  it("Cultivation Stage 5 hitIndex 2 does NOT grant forte (no forte on second hit)", () => {
    const engine = makeEngine()
    hitLanded(engine, "Cultivation::Stage 5", 2, 0)
    expect(engine.getResource(1503).forte).toBe(0)
  })

  it("forte caps at 4 across multiple qualifying hits", () => {
    const engine = makeEngine()
    hitLanded(engine, "Verdant Growth::", 1, 0, 1)
    for (let i = 1; i <= 5; i++) {
      hitLanded(engine, "Cultivation::Stage 5", 1, i, 1)
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
      skillType: "Resonance Skill",
      dmgType: "Damage",
      stageId: "Botany Experiment::",
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
  it.each(["Forte Circuit", "Resonance Liberation", "Outro Skill"] as const)(
    "%s cast grants team Spectro DMG +15% for 24s (sequence 4)",
    (skillType) => {
      const engine = makeEngine(4)
      const baseSpectro = engine.resolveStats(1503).elementBonus["Spectro"]
      engine.onEvent({
        kind: "skillCast",
        characterId: 1503,
        skillType,
        frame: 0,
      })
      expect(engine.activeBuffIds(1503)).toContain(
        "char.verina.s4.blossoming-embrace",
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
      skillType: "Forte Circuit",
      stageId: "Starflower Blooms::Heavy Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1503).allDmgBonus).toBeCloseTo(baseBonus + 0.2)
  })

  it("Starflower Blooms cast emits a synthetic Coordinated Attack hit (sequence 6)", () => {
    const engine = makeEngine(6)
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Forte Circuit",
      stageId: "Starflower Blooms::Heavy Attack",
      frame: 0,
    })
    expect(result.syntheticEvents.length).toBeGreaterThan(0)
    const synthHit = result.syntheticEvents[0]
    expect(synthHit.synthetic).toBe(true)
    expect(synthHit.sourceBuffId).toBe("char.verina.s6.joyous-harvest-coord")
  })

  it("Coord. Attack not emitted at sequence 0", () => {
    const engine = makeEngine(0)
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Forte Circuit",
      stageId: "Starflower Blooms::Heavy Attack",
      frame: 0,
    })
    expect(result.syntheticEvents).toHaveLength(0)
  })
})

describe("Verina — Starflower Blooms Forte consumption (#215)", () => {
  const STARFLOWER_STAGES = [
    "Starflower Blooms::Heavy Attack",
    "Starflower Blooms::Mid-air Attack: Stage 1",
    "Starflower Blooms::Mid-air Attack: Stage 2",
    "Starflower Blooms::Mid-air Attack: Stage 3",
  ] as const

  function grantForte(engine: ReturnType<typeof makeEngine>, amount: number) {
    for (let i = 0; i < amount; i++) {
      engine.onEvent({
        kind: "hitLanded",
        characterId: 1503,
        skillType: "Basic Attack",
        dmgType: "Damage",
        stageId: "Cultivation::Stage 5",
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
    return engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Forte Circuit",
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
      "Starflower Blooms::Heavy Attack",
      100,
    )
    expect(engine.getResource(1503).forte).toBe(0)
    expect(engine.getResource(1503).concerto).toBe(12)
    const healHit = result.syntheticEvents.find(
      (h) => h.sourceBuffId === "char.verina.forte.starflower-consume",
    )
    expect(healHit).toBeDefined()
  })

  it("forte=0 → no consume, no concerto restore, no heal emit", () => {
    const engine = makeEngine()
    expect(engine.getResource(1503).forte).toBe(0)
    const result = castStarflower(engine, "Starflower Blooms::Heavy Attack", 0)
    expect(engine.getResource(1503).forte).toBe(0)
    expect(engine.getResource(1503).concerto).toBe(0)
    const healHit = result.syntheticEvents.find(
      (h) => h.sourceBuffId === "char.verina.forte.starflower-consume",
    )
    expect(healHit).toBeUndefined()
  })

  it("Heavy Attack Starflower Blooms triggers consume when forte=1", () => {
    const engine = makeEngine()
    grantForte(engine, 1)
    castStarflower(engine, "Starflower Blooms::Heavy Attack", 100)
    expect(engine.getResource(1503).forte).toBe(0)
    expect(engine.getResource(1503).concerto).toBe(12)
  })

  it("consume is atomic: forte, concerto, and heal all land or none do", () => {
    const engine = makeEngine()
    grantForte(engine, 1)
    const result = castStarflower(
      engine,
      "Starflower Blooms::Heavy Attack",
      100,
    )
    expect(engine.getResource(1503).forte).toBe(0)
    expect(engine.getResource(1503).concerto).toBe(12)
    const healCount = result.syntheticEvents.filter(
      (h) => h.sourceBuffId === "char.verina.forte.starflower-consume",
    ).length
    expect(healCount).toBe(1)
  })
})

describe("Verina — Arboreal Flourish Photosynthesis Mark + coord (#216)", () => {
  const TEAMMATE_ID = 9999

  function makeTwoCharEngine(sequence = 0) {
    const verinaChar = {
      ...verina,
      buffs: verina.buffs,
    } as unknown as EnrichedCharacter
    const teammate: EnrichedCharacter = {
      id: TEAMMATE_ID,
      name: "Teammate",
      element: "Fusion",
      weaponType: "Sword",
      rarity: "5",
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
      skillType: "Resonance Liberation",
      dmgType: "Damage",
      stageId: "Arboreal Flourish::",
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
    return engine.onEvent({
      kind: "hitLanded",
      characterId: TEAMMATE_ID,
      skillType: "Basic Attack",
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
      "char.verina.lib.photosynthesis-mark",
    )
  })

  it("teammate hit while mark is active fires coord (damage + heal)", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    const result = teammateHit(engine, 10)
    const dmgCoord = result.syntheticEvents.find(
      (h) =>
        h.sourceBuffId === "char.verina.lib.mark-coord-reaction" &&
        h.kind === "hit",
    )
    const healCoord = result.syntheticEvents.find(
      (h) =>
        h.sourceBuffId === "char.verina.lib.mark-coord-reaction" &&
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
        (h) => h.sourceBuffId === "char.verina.lib.mark-coord-reaction",
      ),
    ).toHaveLength(0)
  })

  it("synthetic hits do NOT trigger coord — no coord→coord chain", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    const result = teammateHit(engine, 10, true)
    expect(
      result.syntheticEvents.filter(
        (h) => h.sourceBuffId === "char.verina.lib.mark-coord-reaction",
      ),
    ).toHaveLength(0)
  })

  it("two teammate hits within 60 frames produce exactly one coord pair (ICD)", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    const r1 = teammateHit(engine, 10)
    const r2 = teammateHit(engine, 30)
    const coordsR1 = r1.syntheticEvents.filter(
      (h) => h.sourceBuffId === "char.verina.lib.mark-coord-reaction",
    ).length
    const coordsR2 = r2.syntheticEvents.filter(
      (h) => h.sourceBuffId === "char.verina.lib.mark-coord-reaction",
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
        (h) => h.sourceBuffId === "char.verina.lib.mark-coord-reaction",
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
        (h) => h.sourceBuffId === "char.verina.lib.mark-coord-reaction",
      ),
    ).toHaveLength(0)
  })

  it("coord acting character is Verina even for teammate hit", () => {
    const engine = makeTwoCharEngine()
    libHitLanded(engine, 0)
    const result = teammateHit(engine, 10)
    const coord = result.syntheticEvents.find(
      (h) => h.sourceBuffId === "char.verina.lib.mark-coord-reaction",
    )
    expect(coord?.characterId).toBe(1503)
  })

  it("S6 joyous-harvest-coord still fires independently when mark is active (sequence 6)", () => {
    const engine = makeTwoCharEngine(6)
    libHitLanded(engine, 0)
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Forte Circuit",
      stageId: "Starflower Blooms::Heavy Attack",
      frame: 100,
    })
    const s6Coord = result.syntheticEvents.find(
      (h) => h.sourceBuffId === "char.verina.s6.joyous-harvest-coord",
    )
    expect(s6Coord).toBeDefined()
  })
})

describe("Verina — Arboreal Flourish + teammate combo, end-to-end (#216)", () => {
  const TEAMMATE_ID = 9999
  const COORD_ID = "char.verina.lib.mark-coord-reaction"

  const makeTeammate = (): EnrichedCharacter =>
    ({
      id: TEAMMATE_ID,
      name: "Teammate",
      element: "Fusion",
      weaponType: "Sword",
      rarity: "5",
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
    }) as unknown as EnrichedCharacter

  it("teammate basic combo during 12s mark window triggers coord pairs (damage + heal) at ≈1s cadence", () => {
    const verinaChar = {
      ...verina,
      buffs: verina.buffs,
    } as unknown as EnrichedCharacter
    testCharacters = [verinaChar, makeTeammate()]
    const slots: Slots = [1503, TEAMMATE_ID, null]
    const loadouts: SlotLoadout[] = [
      { ...emptyLoadout },
      { ...emptyLoadout },
      { ...emptyLoadout },
    ]

    const combo = ["S1", "S2", "S3"] as const
    const timeline: TimelineEntry[] = [
      { id: "lib", characterId: 1503, stageId: "Arboreal Flourish::" },
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `na-${i}`,
        characterId: TEAMMATE_ID,
        stageId: `Normal Attack::${combo[i % 3]}`,
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
