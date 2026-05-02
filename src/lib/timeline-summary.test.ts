import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { TimelineEntry } from "#/types/timeline"

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
  skills: [],
}

const charB: EnrichedCharacter = {
  ...charA,
  id: 2,
  name: "Test B",
  stats: {
    base: { hp: 0, atk: 0, def: 0 },
    max: { hp: 0, atk: 500, def: 0 },
  },
}

let testCharacters: EnrichedCharacter[] = []

vi.mock("./catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
}))

import { getTimelineSummary } from "./timeline-summary"

afterEach(() => {
  testCharacters = []
})

function entry(
  characterId: number,
  actionTime: number,
  multiplier: number,
  id = `${characterId}-${actionTime}-${multiplier}`,
): TimelineEntry {
  return {
    id,
    characterId,
    skillType: "Normal Attack",
    skillName: "Stage",
    attackType: "Basic Attack",
    actionTime,
    multiplier,
  }
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
    const result = getTimelineSummary([entry(1, 60, 1.5)])
    expect(result.rows).toEqual([{ time: 0, damage: 1500 }])
    expect(result.totalDamage).toBe(1500)
    expect(result.totalTimeSec).toBe(1)
    expect(result.dps).toBe(1500)
  })

  it("rounds damage to a whole number", () => {
    testCharacters = [
      { ...charA, stats: { ...charA.stats, max: { hp: 0, atk: 3, def: 0 } } },
    ]
    const result = getTimelineSummary([entry(1, 60, 2.5)])
    expect(result.rows[0].damage).toBe(8)
  })

  it("damage is null when multiplier is 0", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([entry(1, 60, 0)])
    expect(result.rows[0].damage).toBeNull()
    expect(result.totalDamage).toBe(0)
  })
})

describe("getTimelineSummary — multi-entry accumulation", () => {
  it("accumulates time across entries (in seconds)", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([
      entry(1, 60, 1.0),
      entry(1, 30, 1.0),
      entry(1, 90, 1.0),
    ])
    expect(result.rows.map((r) => r.time)).toEqual([0, 1, 1.5])
    expect(result.totalTimeSec).toBe(3)
  })

  it("totalDamage sums damages across entries from different characters", () => {
    testCharacters = [charA, charB]
    const result = getTimelineSummary([entry(1, 60, 2.0), entry(2, 60, 3.0)])
    expect(result.totalDamage).toBe(2000 + 1500)
  })
})

describe("getTimelineSummary — zero-multiplier rule", () => {
  it("entries with multiplier <= 0 are excluded from totalDamage but still advance time", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([entry(1, 60, 0), entry(1, 60, 1.0)])
    expect(result.rows[0].damage).toBeNull()
    expect(result.rows[1].damage).toBe(1000)
    expect(result.totalDamage).toBe(1000)
    expect(result.totalTimeSec).toBe(2)
  })
})

describe("getTimelineSummary — dps", () => {
  it("dps is 0 when total time is 0 even with damaging entries", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([entry(1, 0, 1.0)])
    expect(result.totalDamage).toBe(1000)
    expect(result.totalTimeSec).toBe(0)
    expect(result.dps).toBe(0)
  })

  it("dps rounds to a whole number", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([entry(1, 90, 1.0)])
    expect(result.totalTimeSec).toBe(1.5)
    expect(result.totalDamage).toBe(1000)
    expect(result.dps).toBe(667)
  })
})

describe("getTimelineSummary — missing character", () => {
  it("treats unknown characterId as 0 ATK so damage is 0", () => {
    testCharacters = []
    const result = getTimelineSummary([entry(99, 60, 1.0)])
    expect(result.rows[0].damage).toBe(0)
    expect(result.totalDamage).toBe(0)
  })
})
