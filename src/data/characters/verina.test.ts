import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout } from "#/types/loadout"
import { BuffEngine } from "#/lib/buff-engine"
import { pendingNextOnFieldCount } from "#/lib/buff-engine.test-utils"
import { verina } from "./verina"

let testCharacters: EnrichedCharacter[] = []

vi.mock("../../lib/catalog", () => ({
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

  it("Resonance Skill cast does NOT trigger Gift of Nature", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Resonance Skill",
      frame: 0,
    })
    expect(engine.activeBuffIds(1503)).not.toContain(
      "char.verina.inherent.gift-of-nature",
    )
  })
})

describe("Verina — S1 Moment of Emergence (HoT stub)", () => {
  it("requires sequence 1 — not active at sequence 0", () => {
    const engine = makeEngine(0)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Outro Skill",
      frame: 0,
    })
    expect(engine.activeBuffIds(1503)).not.toContain(
      "char.verina.s1.moment-of-emergence",
    )
  })

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

describe("Verina — S2 Sprouting Reflections (Photosynthesis Energy + Concerto)", () => {
  it("Resonance Skill cast adds Photosynthesis Energy stack at sequence 2", () => {
    const engine = makeEngine(2)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Resonance Skill",
      frame: 0,
    })
    expect(engine.activeBuffIds(1503)).toContain(
      "char.verina.s2.photosynthesis-energy",
    )
  })

  it("Photosynthesis Energy stacks up to 4 times", () => {
    const engine = makeEngine(2)
    for (let i = 0; i < 5; i++) {
      engine.onEvent({
        kind: "skillCast",
        characterId: 1503,
        skillType: "Resonance Skill",
        frame: i * 60,
      })
    }
    const stacks = engine
      .activeBuffIds(1503)
      .filter((id) => id === "char.verina.s2.photosynthesis-energy").length
    expect(stacks).toBe(1)
  })

  it("Resonance Skill cast grants +10 Concerto at sequence 2", () => {
    const engine = makeEngine(2)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Resonance Skill",
      frame: 0,
    })
    expect(engine.getResource(1503).concerto).toBe(10)
  })
})

describe("Verina — S3 The Choice to Flourish (healingBonus +12%)", () => {
  it("requires sequence 3 — no healingBonus at sequence 0", () => {
    const engine = makeEngine(0)
    expect(engine.resolveStats(1503).healingBonus).toBeCloseTo(0)
  })

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

  it("not active at sequence 0", () => {
    const engine = makeEngine(0)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Forte Circuit",
      frame: 0,
    })
    expect(engine.activeBuffIds(1503)).not.toContain(
      "char.verina.s4.blossoming-embrace",
    )
  })
})

describe("Verina — S6 Joyous Harvest (DMG + Coord. Attack)", () => {
  const STARFLOWER_STAGES = [
    "Starflower Blooms::Heavy Attack",
    "Starflower Blooms::Mid-air Attack: Stage 1",
    "Starflower Blooms::Mid-air Attack: Stage 2",
    "Starflower Blooms::Mid-air Attack: Stage 3",
  ]

  it.each(STARFLOWER_STAGES)(
    "stageId %s applies +20% allDmgBonus for 1 frame (sequence 6)",
    (stageId) => {
      const engine = makeEngine(6)
      const baseBonus = engine.resolveStats(1503).allDmgBonus
      engine.onEvent({
        kind: "skillCast",
        characterId: 1503,
        skillType: "Forte Circuit",
        stageId,
        frame: 0,
      })
      expect(engine.resolveStats(1503).allDmgBonus).toBeCloseTo(baseBonus + 0.2)
    },
  )

  it("Starflower Blooms cast emits a synthetic Coordinated Attack hit (sequence 6)", () => {
    const engine = makeEngine(6)
    const result = engine.onEvent({
      kind: "skillCast",
      characterId: 1503,
      skillType: "Forte Circuit",
      stageId: "Starflower Blooms::Heavy Attack",
      frame: 0,
    })
    expect(result.syntheticHits.length).toBeGreaterThan(0)
    const synthHit = result.syntheticHits[0]
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
    expect(result.syntheticHits).toHaveLength(0)
  })
})
