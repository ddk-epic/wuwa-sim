import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"

const dmgHit = (value: number, energy = 0, concerto = 0) => ({
  type: "ATK",
  dmgType: "Fusion",
  scalingStat: "atk",
  actionFrame: 0,
  value,
  energy,
  concerto,
  toughness: 0,
  weakness: 0,
})

const charA: EnrichedCharacter = {
  id: 1,
  name: "Char A",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: { inherent: [], resonanceChain: [] },
  skills: [
    {
      id: 1,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage 1",
          value: "100%",
          actionTime: 30,
          damage: [dmgHit(1.5, 5, 2)],
        },
        {
          name: "Stage 2",
          value: "80% + 60%",
          newName: "(Stage 2)",
          actionTime: 40,
          damage: [dmgHit(0.8, 3, 1), dmgHit(0.6, 3, 1)],
        },
      ],
      damage: [],
    },
  ],
}

const charB: EnrichedCharacter = {
  ...charA,
  id: 2,
  name: "Char B",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 500, def: 0 } },
}

const echoA: EnrichedEcho = {
  id: 10,
  name: "Echo One",
  cost: 4,
  element: "Fusion",
  set: "Test Set",
  skill: {
    cooldown: 20,
    description: "Test echo",
    stages: [
      {
        name: "Echo Hit",
        newName: "Hit",
        actionTime: 60,
        damage: [dmgHit(2.0, 10, 5), dmgHit(1.0, 10, 5)],
      },
    ],
  },
}

let testCharacters: EnrichedCharacter[] = []
let testEchoes: EnrichedEcho[] = []

vi.mock("./catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getEchoById: (id: number) => testEchoes.find((e) => e.id === id) ?? null,
}))

import { generateSimulationLog } from "./simulation-log"

afterEach(() => {
  testCharacters = []
  testEchoes = []
})

const emptySlots: Slots = [null, null, null]
const emptyLoadouts: SlotLoadout[] = [
  { weaponId: null, echoId: null, echoSetId: null },
  { weaponId: null, echoId: null, echoSetId: null },
  { weaponId: null, echoId: null, echoSetId: null },
]

function tlEntry(
  characterId: number,
  skillType: string,
  skillName: string,
  id = `${characterId}-${skillType}-${skillName}`,
): TimelineEntry {
  return {
    id,
    characterId,
    skillType,
    skillName,
    attackType: skillType,
    actionTime: 30,
    multiplier: 1,
  }
}

describe("generateSimulationLog — empty", () => {
  it("returns empty array for empty timeline", () => {
    expect(generateSimulationLog([], emptySlots, emptyLoadouts)).toEqual([])
  })
})

describe("generateSimulationLog — single hit", () => {
  it("produces one log entry with correct fields", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      characterId: 1,
      skillType: "Normal Attack",
      skillName: "Normal Attack",
      hit: 1,
      damage: 1500,
      cumulativeEnergy: 5,
      cumulativeConcerto: 2,
    })
  })

  it("rounds damage to whole number", () => {
    testCharacters = [
      { ...charA, stats: { ...charA.stats, max: { hp: 0, atk: 3, def: 0 } } },
    ]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result[0].damage).toBe(5)
  })
})

describe("generateSimulationLog — multi-hit stage", () => {
  it("expands to one entry per DamageEntry hit with 1-based hit index", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack (Stage 2)")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(2)
    expect(result[0].hit).toBe(1)
    expect(result[0].damage).toBe(800)
    expect(result[1].hit).toBe(2)
    expect(result[1].damage).toBe(600)
  })

  it("accumulates energy and concerto across hits of the same stage", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack (Stage 2)")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result[0].cumulativeEnergy).toBe(3)
    expect(result[0].cumulativeConcerto).toBe(1)
    expect(result[1].cumulativeEnergy).toBe(6)
    expect(result[1].cumulativeConcerto).toBe(2)
  })
})

describe("generateSimulationLog — multi-character accumulation", () => {
  it("accumulates energy and concerto separately per character", () => {
    testCharacters = [charA, charB]
    const entries = [
      tlEntry(1, "Normal Attack", "Normal Attack"),
      tlEntry(2, "Normal Attack", "Normal Attack"),
      tlEntry(1, "Normal Attack", "Normal Attack", "1-na-2"),
    ]
    const result = generateSimulationLog(entries, emptySlots, emptyLoadouts)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      characterId: 1,
      cumulativeEnergy: 5,
      cumulativeConcerto: 2,
    })
    expect(result[1]).toMatchObject({
      characterId: 2,
      cumulativeEnergy: 5,
      cumulativeConcerto: 2,
    })
    expect(result[2]).toMatchObject({
      characterId: 1,
      cumulativeEnergy: 10,
      cumulativeConcerto: 4,
    })
  })

  it("computes damage using each character's own maxAtk", () => {
    testCharacters = [charA, charB]
    const entries = [
      tlEntry(1, "Normal Attack", "Normal Attack"),
      tlEntry(2, "Normal Attack", "Normal Attack"),
    ]
    const result = generateSimulationLog(entries, emptySlots, emptyLoadouts)
    expect(result[0].damage).toBe(1500)
    expect(result[1].damage).toBe(750)
  })
})

describe("generateSimulationLog — echo skill entries", () => {
  it("resolves echo damage entries from the character's equipped echo", () => {
    testCharacters = [charA]
    testEchoes = [echoA]
    const slots: Slots = [1, null, null]
    const loadouts: SlotLoadout[] = [
      { weaponId: null, echoId: 10, echoSetId: null },
      { weaponId: null, echoId: null, echoSetId: null },
      { weaponId: null, echoId: null, echoSetId: null },
    ]
    const entry = tlEntry(1, "Echo Skill", "Echo One · Hit")
    const result = generateSimulationLog([entry], slots, loadouts)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      hit: 1,
      damage: 2000,
      cumulativeEnergy: 10,
    })
    expect(result[1]).toMatchObject({
      hit: 2,
      damage: 1000,
      cumulativeEnergy: 20,
    })
  })
})

describe("generateSimulationLog — missing character", () => {
  it("skips entries with unknown characterId", () => {
    testCharacters = []
    const entry = tlEntry(99, "Normal Attack", "Normal Attack")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result).toEqual([])
  })
})

describe("generateSimulationLog — unmatched stage", () => {
  it("skips timeline entries whose stage cannot be found", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack", "Nonexistent Stage")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result).toEqual([])
  })
})
