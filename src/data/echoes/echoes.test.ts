import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { SlotLoadout } from "#/types/loadout"
import { BuffEngine } from "#/lib/engine/buff-engine"
import type { HitLandedEvent } from "#/lib/engine/buff-engine"
import {
  ECHO_BUILD_LAYOUT,
  ECHO_MAIN_3COST_VARIABLE,
} from "#/lib/loadout/echo-stat-constants"
import { infernoRider } from "./inferno-rider"
import { bellBorneGeochelone } from "./bell-borne-geochelone"
import type { EchoSet } from "#/types/echo-set"

const BASE_ELEM_BONUS =
  ECHO_BUILD_LAYOUT["4-3-3-1-1"].cost3 * ECHO_MAIN_3COST_VARIABLE.elemDmg

// Integration tests for the Inferno Rider Tap 3rd-hit buff (#95)
let testCharacters: EnrichedCharacter[] = []
let testEchoes: EnrichedEcho[] = []
let testEchoSets: EchoSet[] = []

vi.mock("../../lib/loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getWeaponById: () => null,
  getEchoById: (id: number) => testEchoes.find((e) => e.id === id) ?? null,
  getEchoSetById: (id: number) => testEchoSets.find((s) => s.id === id) ?? null,
}))

afterEach(() => {
  testCharacters = []
  testEchoes = []
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

const loadoutWithEcho: SlotLoadout = {
  weaponId: null,
  weaponRank: 1,
  echoId: infernoRider.id,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
  echoBuild: "4-3-3-1-1",
  cost4Mains: ["cd"],
  cost3Mains: ["elemDmg", "elemDmg"],
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

const tapHit = (hitIndex: number, frame: number): HitLandedEvent => ({
  kind: "hitLanded",
  characterId: 1,
  skillCategory: "Echo Skill",
  dmgType: "Damage",
  stageId: `echo.inferno-rider._::echo-skill.${hitIndex}`,
  frame,
})

const holdHit = (frame: number): HitLandedEvent => ({
  kind: "hitLanded",
  characterId: 1,
  skillCategory: "Echo Skill",
  dmgType: "Damage",
  stageId: "echo.inferno-rider.hold::echo-skill.1",
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
    expect(engine.resolveStats(1).elementBonus["Fusion"]).toBeCloseTo(
      BASE_ELEM_BONUS,
    )
    expect(engine.activeBuffIds(1)).not.toContain(BUFF_ID)
  })

  it("hit 2 does not trigger the buff", () => {
    const engine = makeEngine()
    engine.recordHit(tapHit(2, 44))
    expect(engine.resolveStats(1).elementBonus["Fusion"]).toBeCloseTo(
      BASE_ELEM_BONUS,
    )
    expect(engine.activeBuffIds(1)).not.toContain(BUFF_ID)
  })

  it("hit 3 triggers the buff exactly once", () => {
    const engine = makeEngine()
    engine.recordHit(tapHit(1, 10))
    engine.recordHit(tapHit(2, 44))
    engine.recordHit(tapHit(3, 121))
    expect(engine.activeBuffIds(1)).toContain(BUFF_ID)
    expect(engine.resolveStats(1).elementBonus["Fusion"]).toBeCloseTo(
      0.12 + BASE_ELEM_BONUS,
    )
    expect(engine.resolveStats(1).skillTypeBonus["Basic Attack"]).toBeCloseTo(
      0.12,
    )
  })

  it("re-casting Tap and landing hit 3 again refreshes (does not add stack)", () => {
    const engine = makeEngine()
    engine.recordHit(tapHit(3, 0))
    expect(engine.activeBuffIds(1)).toContain(BUFF_ID)
    engine.recordHit(tapHit(3, 60))
    expect(engine.activeBuffIds(1)).toContain(BUFF_ID)
    // Still only 1 stack — resolveStats should still show 0.12, not 0.24
    expect(engine.resolveStats(1).elementBonus["Fusion"]).toBeCloseTo(
      0.12 + BASE_ELEM_BONUS,
    )
  })

  it("Hold stage does not trigger the buff", () => {
    const engine = makeEngine()
    engine.recordHit(holdHit(10))
    expect(engine.activeBuffIds(1)).not.toContain(BUFF_ID)
  })
})

describe("bellBorneGeochelone — Echo Skill Tap DMG boost", () => {
  const BBG_BUFF = "echo.bell-borne-geochelone.dmg-boost"

  function makeEngine2() {
    testCharacters = [testChar]
    testEchoes = [bellBorneGeochelone]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, null, null],
      loadouts: [
        {
          ...emptyLoadout,
          echoId: bellBorneGeochelone.id,
        },
        emptyLoadout,
        emptyLoadout,
      ],
    })
    return engine
  }

  it("Echo Skill Tap cast applies +10% allDmgBonus to team", () => {
    const engine = makeEngine2()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Echo Skill",
      stageId: "echo.bell-borne-geochelone._::echo-skill",
      frame: 0,
    })
    expect(engine.activeBuffIds(1)).toContain(BBG_BUFF)
    expect(engine.resolveStats(1).allDmgBonus).toBeCloseTo(0.1)
  })
})
