import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { TimelineEntry } from "#/types/timeline"

import { getTimelineSummary } from "./timeline-summary"

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
      stages: [{ name: "", value: "1", actionTime: 60, damage: [] }],
      damage: [],
    },
    {
      id: 2,
      name: "Heavy Attack",
      type: "Heavy Attack",
      stages: [{ name: "", value: "1", actionTime: 30, damage: [] }],
      damage: [],
    },
    {
      id: 3,
      name: "Resonance Skill",
      type: "Resonance Skill",
      stages: [{ name: "", value: "1", actionTime: 90, damage: [] }],
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
      id: 4,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [{ name: "", value: "1", actionTime: 60, damage: [] }],
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

function entry(
  characterId: number,
  skillType: string,
  skillName: string,
  multiplier: number,
  id = `${characterId}-${skillType}-${skillName}-${multiplier}`,
): TimelineEntry {
  return {
    id,
    characterId,
    skillType,
    skillName,
    attackType: skillType,
    multiplier,
  }
}

function normalAttack(
  characterId: number,
  multiplier: number,
  id?: string,
): TimelineEntry {
  return entry(characterId, "Normal Attack", "Normal Attack", multiplier, id)
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
    const result = getTimelineSummary([normalAttack(1, 1.5)])
    expect(result.rows).toEqual([{ time: 0, damage: 1500 }])
    expect(result.totalDamage).toBe(1500)
    expect(result.totalTimeSec).toBe(1)
    expect(result.dps).toBe(1500)
  })

  it("rounds damage to a whole number", () => {
    testCharacters = [
      { ...charA, stats: { ...charA.stats, max: { hp: 0, atk: 3, def: 0 } } },
    ]
    const result = getTimelineSummary([normalAttack(1, 2.5)])
    expect(result.rows[0].damage).toBe(8)
  })

  it("damage is null when multiplier is 0", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([normalAttack(1, 0)])
    expect(result.rows[0].damage).toBeNull()
    expect(result.totalDamage).toBe(0)
  })
})

describe("getTimelineSummary — multi-entry accumulation", () => {
  it("accumulates time across entries (in seconds)", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([
      normalAttack(1, 1.0, "a"),
      entry(1, "Heavy Attack", "Heavy Attack", 1.0, "b"),
      entry(1, "Resonance Skill", "Resonance Skill", 1.0, "c"),
    ])
    // Normal Attack: 60 frames = 1s, Heavy Attack: 30 frames = 0.5s, Skill: 90 frames = 1.5s
    expect(result.rows.map((r) => r.time)).toEqual([0, 1, 1.5])
    expect(result.totalTimeSec).toBe(3)
  })

  it("totalDamage sums damages across entries from different characters", () => {
    testCharacters = [charA, charB]
    const result = getTimelineSummary([
      normalAttack(1, 2.0),
      normalAttack(2, 3.0),
    ])
    expect(result.totalDamage).toBe(2000 + 1500)
  })
})

describe("getTimelineSummary — zero-multiplier rule", () => {
  it("entries with multiplier <= 0 are excluded from totalDamage but still advance time", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([
      normalAttack(1, 0, "a"),
      normalAttack(1, 1.0, "b"),
    ])
    expect(result.rows[0].damage).toBeNull()
    expect(result.rows[1].damage).toBe(1000)
    expect(result.totalDamage).toBe(1000)
    expect(result.totalTimeSec).toBe(2)
  })
})

describe("getTimelineSummary — dps", () => {
  it("dps is 0 when total time is 0 even with damaging entries", () => {
    testCharacters = [charA]
    // Use a stage with actionTime 0 — no matching stage → falls back to 0
    const e: TimelineEntry = {
      id: "x",
      characterId: 1,
      skillType: "Unknown",
      skillName: "Unknown",
      attackType: "Unknown",
      multiplier: 1.0,
    }
    const result = getTimelineSummary([e])
    expect(result.totalDamage).toBe(1000)
    expect(result.totalTimeSec).toBe(0)
    expect(result.dps).toBe(0)
  })

  it("dps rounds to a whole number", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([
      entry(1, "Resonance Skill", "Resonance Skill", 1.0),
    ])
    // Resonance Skill: 90 frames = 1.5s, damage = 1000 → dps = 667
    expect(result.totalTimeSec).toBe(1.5)
    expect(result.totalDamage).toBe(1000)
    expect(result.dps).toBe(667)
  })
})

describe("getTimelineSummary — missing character", () => {
  it("treats unknown characterId as 0 ATK so damage is 0", () => {
    testCharacters = []
    const result = getTimelineSummary([normalAttack(99, 1.0)])
    expect(result.rows[0].damage).toBe(0)
    expect(result.totalDamage).toBe(0)
  })
})
