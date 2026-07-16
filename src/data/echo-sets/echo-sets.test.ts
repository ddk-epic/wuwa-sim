// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { EchoSet } from "#/types/echo-set"
import type { SlotLoadout } from "#/types/loadout"
import { BuffEngine } from "#/lib/engine/buff-engine"
import type { HealLandedEvent, HitLandedEvent } from "#/lib/engine/buff-engine"
import { ALL_ECHO_SETS } from "./index"

let testEchoSets: EchoSet[] = []
let testCharacters: EnrichedCharacter[] = []

vi.mock("../../lib/loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getWeaponById: () => null,
  getEchoById: () => null,
  getEchoSetById: (id: number) => testEchoSets.find((s) => s.id === id) ?? null,
}))

afterEach(() => {
  testEchoSets = []
  testCharacters = []
})

const testChar: EnrichedCharacter = {
  id: 1,
  name: "Test",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  maxEnergy: 100,
  forteCap: 100,
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [],
}

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

describe("Rejuvenating Glow — 2pc healingBonus + 5pc team ATK on heal", () => {
  const rejuvenatingGlow = ALL_ECHO_SETS.find((s) => s.id === 7)!
  const RG_2PC = "echo-set.rejuvenating-glow.2pc.healing-bonus"
  const RG_5PC = "echo-set.rejuvenating-glow.5pc.team-atk"

  function makeRGEngine(pieces: 2 | 5) {
    testEchoSets = [rejuvenatingGlow]
    testCharacters = [testChar]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, null, null],
      loadouts: [
        {
          ...emptyLoadout,
          echoSetSlot1Id: pieces >= 2 ? rejuvenatingGlow.id : null,
          echoSetSlot2Id: pieces >= 5 ? rejuvenatingGlow.id : null,
        },
        emptyLoadout,
        emptyLoadout,
      ],
    })
    return engine
  }

  it("2pc folds healingBonus +10% into base stats (permanent, no event needed)", () => {
    const engine = makeRGEngine(2)
    expect(engine.resolveStats(1).healingBonus).toBeCloseTo(0.1)
    expect(engine.activeBuffIds(1)).not.toContain(RG_2PC)
  })

  it("5pc fires on healLanded and grants team +15% ATK for 30s", () => {
    const engine = makeRGEngine(5)
    const baseAtkPct = engine.resolveStats(1).atkPct
    const healEv: HealLandedEvent = {
      kind: "healLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    }
    engine.recordHeal(healEv)
    expect(engine.activeBuffIds(1)).toContain(RG_5PC)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(baseAtkPct + 0.15)
  })
})

describe("Windward Pilgrimage — 2pc Aero fold + 5pc Aero-Erosion hit gate", () => {
  const windwardPilgrimage = ALL_ECHO_SETS.find((s) => s.id === 17)!
  const WP_2PC = "echo-set.windward-pilgrimage.2pc.aero-bonus"
  const WP_5PC = "echo-set.windward-pilgrimage.5pc.aero-crit"

  // Rides a Resonance Skill cast to land Aero Erosion on the target.
  const applyErosion: BuffDef = {
    id: "test.apply-erosion",
    name: "Apply Erosion",
    trigger: { event: "skillCast", skillCategory: "Resonance Skill" },
    effects: [{ kind: "negStatus", status: "Aero Erosion", op: "apply", n: 1 }],
  }

  const selfHit: HitLandedEvent = {
    kind: "hitLanded",
    characterId: 1,
    skillCategory: "Basic Attack",
    dmgType: "Damage",
    frame: 0,
  }

  function makeWPEngine(pieces: 0 | 2 | 5) {
    testEchoSets = [windwardPilgrimage]
    testCharacters = [{ ...testChar, element: "Aero", buffs: [applyErosion] }]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, null, null],
      loadouts: [
        {
          ...emptyLoadout,
          echoSetSlot1Id: pieces >= 2 ? windwardPilgrimage.id : null,
          echoSetSlot2Id: pieces >= 5 ? windwardPilgrimage.id : null,
        },
        emptyLoadout,
        emptyLoadout,
      ],
    })
    return engine
  }

  it("2pc folds Aero DMG +10% into base stats (permanent, no event needed)", () => {
    const baseAero = makeWPEngine(0).resolveStats(1).elementBonus["Aero"]
    const engine = makeWPEngine(2)
    expect(engine.resolveStats(1).elementBonus["Aero"]).toBeCloseTo(
      baseAero + 0.1,
    )
    expect(engine.activeBuffIds(1)).not.toContain(WP_2PC)
  })

  it("5pc does not fire when the hit lands on a target without Aero Erosion", () => {
    const engine = makeWPEngine(5)
    engine.recordHit(selfHit)
    expect(engine.activeBuffIds(1)).not.toContain(WP_5PC)
  })

  it("5pc fires when the hit lands on a target carrying Aero Erosion, granting crit + Aero DMG for 10s", () => {
    const engine = makeWPEngine(5)
    const baseAero = engine.resolveStats(1).elementBonus["Aero"]
    const baseCrit = engine.resolveStats(1).critRate
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    expect(engine.getTarget().stacksOf("Aero Erosion")).toBe(1)
    engine.recordHit({ ...selfHit, frame: 1 })
    expect(engine.activeBuffIds(1)).toContain(WP_5PC)
    expect(engine.resolveStats(1).critRate).toBeCloseTo(baseCrit + 0.1)
    expect(engine.resolveStats(1).elementBonus["Aero"]).toBeCloseTo(
      baseAero + 0.3,
    )
  })
})
