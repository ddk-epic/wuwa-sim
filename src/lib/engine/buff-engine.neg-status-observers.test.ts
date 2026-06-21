// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { Slots } from "#/types/loadout"
import { AERO_EROSION } from "#/data/neg-statuses"
import { BuffEngine } from "./buff-engine"
import { baseChar, emptyLoadout } from "./buff-engine.test-fixtures"

let testCharacters: EnrichedCharacter[] = []

vi.mock("../loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getWeaponById: () => null,
  getEchoById: () => null,
  getEchoSetById: () => null,
}))

afterEach(() => {
  testCharacters = []
})

function bootstrap(chars: EnrichedCharacter[], slots: Slots): BuffEngine {
  testCharacters = chars
  const engine = new BuffEngine()
  engine.bootstrap({
    slots,
    loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
  })
  return engine
}

describe("fromStatusStacks value-expr", () => {
  const vulBuff: BuffDef = {
    id: "test.erosion-vul",
    name: "Erosion Vulnerability",
    trigger: { event: "simStart" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    condition: { kind: "targetHasNegStatus" },
    effects: [
      {
        kind: "stat",
        path: { stat: "vul" },
        value: {
          kind: "fromStatusStacks",
          status: "Aero Erosion",
          base: 0.3,
          per: 0.1,
          max: 6,
          threshold: 1,
        },
      },
    ],
  }

  it("resolves vul live from the target's stack count, recomputing per resolution", () => {
    const engine = bootstrap(
      [baseChar({ id: 1, buffs: [vulBuff] })],
      [1, null, null],
    )
    const target = engine.getTarget()

    expect(engine.resolveStats(1).vul).toBeCloseTo(0)

    target.apply(AERO_EROSION, 1, 0, 1)
    expect(engine.resolveStats(1).vul).toBeCloseTo(0.3)

    target.apply(AERO_EROSION, 1, 0, 1)
    expect(engine.resolveStats(1).vul).toBeCloseTo(0.4)

    target.apply(AERO_EROSION, 1, 0, 1)
    expect(engine.resolveStats(1).vul).toBeCloseTo(0.5)
  })
})

describe("negStatusInflicted trigger", () => {
  const applyErosion: BuffDef = {
    id: "test.apply-erosion",
    name: "Apply Erosion",
    trigger: { event: "skillCast", skillCategory: "Resonance Skill" },
    effects: [{ kind: "negStatus", status: "Aero Erosion", op: "apply", n: 1 }],
  }

  const teamBuff: BuffDef = {
    id: "test.erosion-team-dmg",
    name: "Erosion Team DMG",
    trigger: { event: "negStatusInflicted", status: "Aero Erosion" },
    target: { kind: "global" },
    duration: { kind: "seconds", v: 10 },
    effects: [
      {
        kind: "stat",
        path: { stat: "allDmgBonus" },
        value: { kind: "const", v: 0.2 },
      },
    ],
  }

  it("inflicting Aero Erosion grants the whole team a DMG Bonus for the buff duration", () => {
    const engine = bootstrap(
      [
        baseChar({ id: 1, buffs: [applyErosion, teamBuff] }),
        baseChar({ id: 2 }),
      ],
      [1, 2, null],
    )
    const before = engine.resolveStats(2).allDmgBonus

    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 10,
    })

    expect(engine.resolveStats(2).allDmgBonus).toBeCloseTo(before + 0.2)

    engine.tickToFrame(10 + 10 * 60 + 1)
    expect(engine.resolveStats(2).allDmgBonus).toBeCloseTo(before)
  })

  it("does not fire on a non-matching status filter", () => {
    const frazzleListener: BuffDef = {
      ...teamBuff,
      id: "test.frazzle-listener",
      trigger: { event: "negStatusInflicted", status: "Spectro Frazzle" },
    }
    const engine = bootstrap(
      [baseChar({ id: 1, buffs: [applyErosion, frazzleListener] })],
      [1, null, null],
    )
    const before = engine.resolveStats(1).allDmgBonus

    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 10,
    })

    expect(engine.resolveStats(1).allDmgBonus).toBeCloseTo(before)
  })
})
