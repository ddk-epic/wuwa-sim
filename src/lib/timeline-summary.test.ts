import { afterEach, describe, expect, it, vi } from "vitest"
import type { DamageEntry, EnrichedCharacter } from "#/types/character"
import type { TimelineEntry } from "#/types/timeline"

import { getTimelineSummary } from "./timeline-summary"

const dmgEntry = (value: number): DamageEntry => ({
  type: "Basic Attack",
  dmgType: "Fusion",
  scalingStat: "ATK",
  actionFrame: 0,
  value,
  energy: 0,
  concerto: 0,
  toughness: 0,
  weakness: 0,
})

const charA: EnrichedCharacter = {
  id: 1,
  name: "Test A",
  element: "Fusion",
  weaponType: "Rectifier",
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
      stages: [
        { name: "", value: "1", actionTime: 60, damage: [dmgEntry(1.5)] },
      ],
      damage: [],
    },
    {
      id: 2,
      name: "Heavy Attack",
      type: "Heavy Attack",
      stages: [
        { name: "", value: "1", actionTime: 30, damage: [dmgEntry(1.0)] },
      ],
      damage: [],
    },
    {
      id: 3,
      name: "Resonance Skill",
      type: "Resonance Skill",
      stages: [
        { name: "", value: "1", actionTime: 90, damage: [dmgEntry(1.0)] },
      ],
      damage: [],
    },
    {
      id: 4,
      name: "No Damage Skill",
      type: "Forte Circuit",
      stages: [{ name: "", value: "0", actionTime: 60, damage: [] }],
      damage: [],
    },
    {
      id: 5,
      name: "Instant Skill",
      type: "Resonance Skill",
      stages: [
        { name: "", value: "1", actionTime: 0, damage: [dmgEntry(1.0)] },
      ],
      damage: [],
    },
  ],
}

const charB: EnrichedCharacter = {
  ...charA,
  id: 2,
  name: "Test B",
  stats: {
    base: { hp: 0, atk: 0, def: 0 },
    max: { hp: 0, atk: 500, def: 0 },
  },
  skills: [
    {
      id: 6,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        { name: "", value: "1", actionTime: 60, damage: [dmgEntry(1.5)] },
      ],
      damage: [],
    },
  ],
}

let testCharacters: EnrichedCharacter[] = []

vi.mock("./catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getEchoById: () => null,
}))

afterEach(() => {
  testCharacters = []
})

function tlEntry(
  characterId: number,
  stageId: string,
  id = `${characterId}-${stageId}`,
): TimelineEntry {
  return { id, characterId, stageId }
}

function normalAttack(characterId: number, id?: string): TimelineEntry {
  return tlEntry(characterId, "Normal Attack::_", id)
}

describe("getTimelineSummary — empty", () => {
  it("returns empty rows and zero aggregates for empty Timeline", () => {
    const result = getTimelineSummary([])
    expect(result).toEqual({
      rows: [],
      totalDamage: 0,
      totalTimeSec: 0,
      dps: 0,
    })
  })
})

describe("getTimelineSummary — single entry", () => {
  it("first row starts at time 0 and includes computed damage", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([normalAttack(1)])
    expect(result.rows).toEqual([{ time: 0, damage: 1500 }])
    expect(result.totalDamage).toBe(1500)
    expect(result.totalTimeSec).toBe(1)
    expect(result.dps).toBe(1500)
  })

  it("rounds damage to a whole number", () => {
    testCharacters = [
      { ...charA, stats: { ...charA.stats, max: { hp: 0, atk: 3, def: 0 } } },
    ]
    const result = getTimelineSummary([normalAttack(1)])
    // 1.5 * 3 = 4.5, rounds to 5
    expect(result.rows[0].damage).toBe(5)
  })

  it("damage is null when stage has no damage entries", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([tlEntry(1, "No Damage Skill::_")])
    expect(result.rows[0].damage).toBeNull()
    expect(result.totalDamage).toBe(0)
  })
})

describe("getTimelineSummary — multi-entry accumulation", () => {
  it("accumulates time across entries (in seconds)", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([
      normalAttack(1, "a"),
      tlEntry(1, "Heavy Attack::_", "b"),
      tlEntry(1, "Resonance Skill::_", "c"),
    ])
    // Normal Attack: 60f=1s, Heavy Attack: 30f=0.5s, Resonance Skill: 90f=1.5s
    expect(result.rows.map((r) => r.time)).toEqual([0, 1, 1.5])
    expect(result.totalTimeSec).toBe(3)
  })

  it("totalDamage sums damages across entries from different characters", () => {
    testCharacters = [charA, charB]
    const result = getTimelineSummary([normalAttack(1), normalAttack(2)])
    // charA: 1.5 * 1000 = 1500, charB: 1.5 * 500 = 750
    expect(result.totalDamage).toBe(2250)
  })
})

describe("getTimelineSummary — zero-damage rule", () => {
  it("stages with no damage entries are excluded from totalDamage but still advance time", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([
      tlEntry(1, "No Damage Skill::_", "a"),
      normalAttack(1, "b"),
    ])
    expect(result.rows[0].damage).toBeNull()
    expect(result.rows[1].damage).toBe(1500)
    expect(result.totalDamage).toBe(1500)
    expect(result.totalTimeSec).toBe(2) // No Damage 60f + Normal Attack 60f = 2s
  })
})

describe("getTimelineSummary — dps", () => {
  it("dps is 0 when total time is 0 even with damaging entries", () => {
    testCharacters = [charA]
    // Instant Skill has actionTime=0 and damage entries → time=0, damage=1000
    const result = getTimelineSummary([tlEntry(1, "Instant Skill::_", "x")])
    expect(result.totalDamage).toBe(1000)
    expect(result.totalTimeSec).toBe(0)
    expect(result.dps).toBe(0)
  })

  it("dps rounds to a whole number", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([tlEntry(1, "Resonance Skill::_")])
    // 90f = 1.5s, damage = 1.0 * 1000 = 1000 → dps = round(667) = 667
    expect(result.totalTimeSec).toBe(1.5)
    expect(result.totalDamage).toBe(1000)
    expect(result.dps).toBe(667)
  })
})

describe("getTimelineSummary — missing character", () => {
  it("treats unknown characterId as null damage (stage cannot be resolved)", () => {
    testCharacters = []
    const result = getTimelineSummary([normalAttack(99)])
    expect(result.rows[0].damage).toBeNull()
    expect(result.totalDamage).toBe(0)
  })
})
