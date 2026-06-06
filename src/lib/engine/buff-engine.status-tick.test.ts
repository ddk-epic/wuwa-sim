import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import { BuffEngine } from "./buff-engine"
import { baseChar, emptyLoadout, slotsOf } from "./buff-engine.test-fixtures"

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

const applyErosion = (n: number): BuffDef => ({
  id: "test.apply-erosion",
  name: "Apply Erosion",
  trigger: { event: "skillCast", skillCategory: "Resonance Skill" },
  effects: [{ kind: "negStatus", status: "Aero Erosion", op: "apply", n }],
})

function bootstrap(buffs: BuffDef[]): BuffEngine {
  testCharacters = [baseChar({ id: 1, buffs })]
  const engine = new BuffEngine()
  engine.bootstrap({
    slots: slotsOf(1),
    loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
  })
  return engine
}

function castResoSkill(engine: BuffEngine, frame: number): void {
  engine.onEvent({
    kind: "skillCast",
    characterId: 1,
    skillCategory: "Resonance Skill",
    frame,
  })
}

// baseChar resolves to 0 Aero bonus / 0 deepen / 0 vul, so a tick is
// baseUnit × factor × defMult(0.5) × resMult(0.9).
const DEFRES = 0.45
const tickDmg = (factor: number) => Math.round(2150 * factor * DEFRES)

describe("Aero Erosion tick cadence", () => {
  it("emits periodic ticks at the configured interval across the duration", () => {
    const engine = bootstrap([applyErosion(1)])
    castResoSkill(engine, 0)

    const ticks = engine.tickToFrame(2000).tickEvents
    expect(ticks.map((t) => t.frame)).toEqual([150, 300, 450, 600, 750])
    expect(ticks.every((t) => t.damage === tickDmg(0.8))).toBe(true)
    expect(ticks[0].characterId).toBe(1)
  })

  it("reads the live stack count at each tick", () => {
    const engine = bootstrap([applyErosion(1)])
    castResoSkill(engine, 0)
    expect(engine.tickToFrame(200).tickEvents.map((t) => t.damage)).toEqual([
      tickDmg(0.8),
    ])

    castResoSkill(engine, 210)
    castResoSkill(engine, 220)
    expect(engine.getTarget().stacksOf("Aero Erosion")).toBe(3)

    const next = engine.tickToFrame(350).tickEvents
    expect(next.map((t) => t.frame)).toEqual([300])
    expect(next[0].damage).toBe(tickDmg(4))
  })

  it("forces crit off — tick damage ignores the inflictor's crit", () => {
    const critBuff: BuffDef = {
      id: "test.crit",
      name: "Crit",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      condition: { kind: "targetHasNegStatus" },
      effects: [
        {
          kind: "stat",
          path: { stat: "critRate" },
          value: { kind: "const", v: 1 },
        },
        {
          kind: "stat",
          path: { stat: "critDmg" },
          value: { kind: "const", v: 3 },
        },
      ],
    }
    const engine = bootstrap([applyErosion(1), critBuff])
    castResoSkill(engine, 0)
    const ticks = engine.tickToFrame(200).tickEvents
    expect(ticks[0].damage).toBe(tickDmg(0.8))
  })
})

describe("Aero Erosion label-scoped Deepen", () => {
  const erosionDeepen: BuffDef = {
    id: "test.erosion-deepen",
    name: "Erosion Deepen",
    trigger: { event: "simStart" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    appliesToHits: { label: "Aero Erosion" },
    effects: [
      {
        kind: "stat",
        path: { stat: "allDeepen" },
        value: { kind: "const", v: 0.5 },
      },
    ],
  }

  it("folds into ticks and any labelled hit, but not a non-labelled hit", () => {
    const engine = bootstrap([applyErosion(1), erosionDeepen])
    castResoSkill(engine, 0)

    const ticks = engine.tickToFrame(200).tickEvents
    expect(ticks[0].damage).toBe(Math.round(2150 * 0.8 * 1.5 * DEFRES))

    expect(
      engine.resolveStats(1, {
        labels: ["Aero Erosion"],
        skillType: "Basic Attack",
      }).allDeepen,
    ).toBeCloseTo(0.5)
    expect(
      engine.resolveStats(1, { skillType: "Basic Attack" }).allDeepen,
    ).toBeCloseTo(0)
  })
})

describe("negStatusMod interval modifier", () => {
  const mandate = (intervalMult: number, durationSec: number): BuffDef => ({
    id: "test.mandate",
    name: "Mandate",
    trigger: { event: "skillCast", skillCategory: "Resonance Skill" },
    target: { kind: "self" },
    duration: { kind: "seconds", v: durationSec },
    effects: [{ kind: "negStatusMod", status: "Aero Erosion", intervalMult }],
  })

  it("halves the tick interval, roughly doubling the tick count", () => {
    const base = bootstrap([applyErosion(1)])
    castResoSkill(base, 0)
    const baseCount = base.tickToFrame(2000).tickEvents.length

    const halved = bootstrap([applyErosion(1), mandate(0.5, 1000)])
    castResoSkill(halved, 0)
    const ticks = halved.tickToFrame(2000).tickEvents
    expect(ticks.map((t) => t.frame)).toEqual([
      75, 150, 225, 300, 375, 450, 525, 600, 675, 750, 825,
    ])
    expect(ticks.length).toBeGreaterThanOrEqual(baseCount * 2)
  })

  it("reverts the interval to base once the modifier buff expires", () => {
    const engine = bootstrap([applyErosion(1), mandate(0.5, 5)])
    castResoSkill(engine, 0)
    const frames = engine.tickToFrame(2000).tickEvents.map((t) => t.frame)

    // 75-frame cadence while Mandate is active (endTime 300), then 150 after.
    expect(frames.slice(0, 4)).toEqual([75, 150, 225, 300])
    const lastTwoGap = frames[frames.length - 1] - frames[frames.length - 2]
    expect(lastTwoGap).toBe(150)
  })
})
