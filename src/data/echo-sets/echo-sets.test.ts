import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EchoSet } from "#/types/echo-set"
import type { SlotLoadout } from "#/types/loadout"
import { BuffEngine } from "#/lib/engine/buff-engine"
import type { HealLandedEvent } from "#/lib/engine/buff-engine"
import { ALL_ECHO_SETS } from "./index"

let testEchoSets: EchoSet[] = []

vi.mock("../../lib/loadout/catalog", () => ({
  getCharacterById: (id: number) => (id === 1 ? testChar : null),
  getWeaponById: () => null,
  getEchoById: () => null,
  getEchoSetById: (id: number) => testEchoSets.find((s) => s.id === id) ?? null,
}))

afterEach(() => {
  testEchoSets = []
})

const testChar: EnrichedCharacter = {
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
