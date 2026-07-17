// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import { BuffEngine } from "./buff-engine"
import {
  BASE_ATK_PCT,
  baseChar,
  emptyLoadout,
  slotsOf,
} from "./buff-engine.test-fixtures"

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

const applyErosion: BuffDef = {
  id: "test.apply-erosion",
  name: "Apply Erosion",
  trigger: { event: "skillCast", skillCategory: "Resonance Skill" },
  effects: [{ kind: "negStatus", status: "Aero Erosion", op: "apply", n: 2 }],
}

const presenceBuff: BuffDef = {
  id: "test.presence",
  name: "Presence",
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  condition: { kind: "targetHasNegStatus" },
  effects: [
    {
      kind: "stat",
      path: { stat: "atkPct" },
      value: { kind: "const", v: 0.5 },
    },
  ],
}

function bootstrap(buffs: BuffDef[]): BuffEngine {
  testCharacters = [baseChar({ id: 1, buffs })]
  const engine = new BuffEngine()
  engine.bootstrap({
    slots: slotsOf(1),
    loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
  })
  return engine
}

describe("negStatus effect", () => {
  it("apply op rides a skillCast trigger and lands stacks on the target", () => {
    const engine = bootstrap([applyErosion])
    expect(engine.getTarget().hasAnyStatus()).toBe(false)

    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 10,
    })

    expect(engine.getTarget().stacksOf("Aero Erosion")).toBe(2)
  })
})

describe("targetHasNegStatus condition", () => {
  it("gates a buff to activate only while a Negative Status is present", () => {
    const engine = bootstrap([applyErosion, presenceBuff])
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)

    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 10,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT + 0.5)
  })

  it("deactivates once the status expires", () => {
    const engine = bootstrap([applyErosion, presenceBuff])
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
      frame: 10,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT + 0.5)

    engine.tickToFrame(10 + 15 * 60)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)
  })
})
