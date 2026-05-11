import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { SlotLoadout } from "#/types/loadout"
import { BuffEngine } from "#/lib/buff-engine"
import type { HitLandedEvent } from "#/lib/buff-engine"
import { infernoRider } from "./inferno-rider"

// Integration tests for the Inferno Rider Tap 3rd-hit buff (#95)
let testCharacters: EnrichedCharacter[] = []
let testEchoes: EnrichedEcho[] = []

vi.mock("../../lib/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getWeaponById: () => null,
  getEchoById: (id: number) => testEchoes.find((e) => e.id === id) ?? null,
  getEchoSetById: () => null,
}))

afterEach(() => {
  testCharacters = []
  testEchoes = []
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

const loadoutWithEcho: SlotLoadout = {
  weaponId: null,
  weaponRank: 1,
  echoId: infernoRider.id,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
}

const emptyLoadout: SlotLoadout = {
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
}

const tapHit = (hitIndex: number, frame: number): HitLandedEvent => ({
  kind: "hitLanded",
  characterId: 1,
  skillType: "Echo Skill",
  dmgType: "Damage",
  stage: "Tap",
  hitIndex,
  frame,
})

const holdHit = (frame: number): HitLandedEvent => ({
  kind: "hitLanded",
  characterId: 1,
  skillType: "Echo Skill",
  dmgType: "Damage",
  stage: "Hold",
  hitIndex: 1,
  frame,
})

const BUFF_ID = "echo.inferno-rider.tap.fusion-basic-bonus"

function makeEngine() {
  testCharacters = [testChar]
  testEchoes = [infernoRider]
  const engine = new BuffEngine()
  engine.bootstrap({
    slots: [1, null, null],
    loadouts: [loadoutWithEcho, emptyLoadout, emptyLoadout],
  })
  return engine
}

describe("infernoRider — Tap 3rd-hit buff integration (#95)", () => {
  it("hit 1 does not trigger the buff", () => {
    const engine = makeEngine()
    engine.recordHit(tapHit(1, 10))
    expect(engine.resolveStats(1).elementBonus["Fusion"] ?? 0).toBe(0)
    expect(engine.activeBuffIds(1)).not.toContain(BUFF_ID)
  })

  it("hit 2 does not trigger the buff", () => {
    const engine = makeEngine()
    engine.recordHit(tapHit(2, 44))
    expect(engine.resolveStats(1).elementBonus["Fusion"] ?? 0).toBe(0)
    expect(engine.activeBuffIds(1)).not.toContain(BUFF_ID)
  })

  it("hit 3 triggers the buff exactly once", () => {
    const engine = makeEngine()
    engine.recordHit(tapHit(1, 10))
    engine.recordHit(tapHit(2, 44))
    engine.recordHit(tapHit(3, 121))
    expect(engine.activeBuffIds(1)).toContain(BUFF_ID)
    expect(engine.resolveStats(1).elementBonus["Fusion"]).toBeCloseTo(0.12)
    expect(engine.resolveStats(1).skillTypeBonus["Basic Attack"]).toBeCloseTo(
      0.12,
    )
  })

  it("both effects are active after hit 3", () => {
    const engine = makeEngine()
    engine.recordHit(tapHit(3, 121))
    const stats = engine.resolveStats(1)
    expect(stats.elementBonus["Fusion"]).toBeCloseTo(0.12)
    expect(stats.skillTypeBonus["Basic Attack"]).toBeCloseTo(0.12)
  })

  it("buff expires after 15 seconds (900 frames)", () => {
    const engine = makeEngine()
    engine.recordHit(tapHit(3, 0))
    expect(engine.activeBuffIds(1)).toContain(BUFF_ID)
    engine.tickToFrame(900).lifecycleEvents
    expect(engine.activeBuffIds(1)).not.toContain(BUFF_ID)
  })

  it("re-casting Tap and landing hit 3 again refreshes (does not add stack)", () => {
    const engine = makeEngine()
    engine.recordHit(tapHit(3, 0))
    expect(engine.activeBuffIds(1)).toContain(BUFF_ID)
    engine.recordHit(tapHit(3, 60))
    expect(engine.activeBuffIds(1)).toContain(BUFF_ID)
    // Still only 1 stack — resolveStats should still show 0.12, not 0.24
    expect(engine.resolveStats(1).elementBonus["Fusion"]).toBeCloseTo(0.12)
  })

  it("Hold stage does not trigger the buff", () => {
    const engine = makeEngine()
    engine.recordHit(holdHit(10))
    expect(engine.activeBuffIds(1)).not.toContain(BUFF_ID)
  })
})
