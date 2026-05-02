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
  buffs: [],
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

const charD: EnrichedCharacter = {
  ...charA,
  id: 4,
  name: "Char D",
  skills: [
    {
      id: 3,
      name: "Heavy Attack",
      type: "Heavy Attack",
      stages: [
        {
          name: "Heavy Attack",
          value: "200%",
          actionTime: 30,
          concerto: 15,
          damage: [dmgHit(2.0, 5, 0)],
        },
      ],
      damage: [],
    },
  ],
}

const echoA: EnrichedEcho = {
  id: 10,
  name: "Echo One",
  cost: 4,
  element: "Fusion",
  set: "Test Set",
  buffs: [],
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
  it("produces one action event and one hit event per timeline entry", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      kind: "action",
      characterId: 1,
      skillType: "Normal Attack",
      skillName: "Normal Attack",
      frame: 0,
      cumulativeEnergy: 0,
      cumulativeConcerto: 0,
    })
    expect(result[1]).toMatchObject({
      kind: "hit",
      characterId: 1,
      skillType: "Normal Attack",
      skillName: "Normal Attack [hit 1]",
      frame: 0,
      cumulativeEnergy: 5,
      cumulativeConcerto: 2,
      damage: 675,
      activeBuffIds: [],
    })
    expect(
      (result[1] as { statsSnapshot: { atkBase: number } }).statsSnapshot,
    ).toMatchObject({ atkBase: 1000 })
  })

  it("rounds damage to whole number", () => {
    testCharacters = [
      { ...charA, stats: { ...charA.stats, max: { hp: 0, atk: 3, def: 0 } } },
    ]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({ kind: "hit", damage: 2 })
  })
})

describe("generateSimulationLog — multi-hit stage", () => {
  it("emits one action event then one hit event per DamageEntry with [hit N] suffix", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack (Stage 2)")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      kind: "action",
      skillName: "Normal Attack (Stage 2)",
    })
    expect(result[1]).toMatchObject({
      kind: "hit",
      skillName: "Normal Attack (Stage 2) [hit 1]",
      damage: 360,
    })
    expect(result[2]).toMatchObject({
      kind: "hit",
      skillName: "Normal Attack (Stage 2) [hit 2]",
      damage: 270,
    })
  })

  it("accumulates energy and concerto across hits of the same stage", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack (Stage 2)")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result[1].cumulativeEnergy).toBe(3)
    expect(result[1].cumulativeConcerto).toBe(1)
    expect(result[2].cumulativeEnergy).toBe(6)
    expect(result[2].cumulativeConcerto).toBe(2)
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
    expect(result).toHaveLength(6)
    expect(result[1]).toMatchObject({
      kind: "hit",
      characterId: 1,
      cumulativeEnergy: 5,
      cumulativeConcerto: 2,
    })
    expect(result[3]).toMatchObject({
      kind: "hit",
      characterId: 2,
      cumulativeEnergy: 5,
      cumulativeConcerto: 2,
    })
    expect(result[5]).toMatchObject({
      kind: "hit",
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
    expect(result).toHaveLength(4)
    expect(result[1]).toMatchObject({ kind: "hit", damage: 675 })
    expect(result[3]).toMatchObject({ kind: "hit", damage: 338 })
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
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      kind: "action",
      characterId: 1,
      cumulativeConcerto: 0,
      cumulativeEnergy: 0,
    })
    expect(result[1]).toMatchObject({
      kind: "hit",
      damage: 900,
      cumulativeEnergy: 10,
      cumulativeConcerto: 5,
    })
    expect(result[2]).toMatchObject({
      kind: "hit",
      damage: 450,
      cumulativeEnergy: 20,
      cumulativeConcerto: 10,
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

describe("generateSimulationLog — frame tracking", () => {
  it("assigns stageStartFrame to action events and stageStartFrame + actionFrame to hit events", () => {
    testCharacters = [charA]
    const entry1: TimelineEntry = {
      id: "e1",
      characterId: 1,
      skillType: "Normal Attack",
      skillName: "Normal Attack",
      attackType: "Normal Attack",
      actionTime: 60,
      multiplier: 1,
    }
    const entry2: TimelineEntry = {
      id: "e2",
      characterId: 1,
      skillType: "Normal Attack",
      skillName: "Normal Attack",
      attackType: "Normal Attack",
      actionTime: 30,
      multiplier: 1,
    }
    const result = generateSimulationLog(
      [entry1, entry2],
      emptySlots,
      emptyLoadouts,
    )
    expect(result).toHaveLength(4)
    expect(result[0].frame).toBe(0)
    expect(result[1].frame).toBe(0)
    expect(result[2].frame).toBe(60)
    expect(result[3].frame).toBe(60)
  })
})

describe("generateSimulationLog — action event concerto", () => {
  it("accumulates stage.concerto on action event without advancing energy", () => {
    testCharacters = [charD]
    const entry: TimelineEntry = {
      id: "d1",
      characterId: 4,
      skillType: "Heavy Attack",
      skillName: "Heavy Attack",
      attackType: "Heavy Attack",
      actionTime: 30,
      multiplier: 1,
    }
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      kind: "action",
      cumulativeConcerto: 15,
      cumulativeEnergy: 0,
    })
    expect(result[1]).toMatchObject({
      kind: "hit",
      cumulativeConcerto: 15,
      cumulativeEnergy: 5,
    })
  })
})

describe("generateSimulationLog — stats snapshot", () => {
  it("populates statsSnapshot and empty activeBuffIds on every HitEvent", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack (Stage 2)")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(2)
    for (const hit of hits) {
      expect(hit.activeBuffIds).toEqual([])
      expect(hit.statsSnapshot).toMatchObject({
        atkBase: 1000,
        atkPct: 0,
        atkFlat: 0,
        critRate: 0,
        critDmg: 0,
      })
    }
  })
})

describe("generateSimulationLog — discriminated union", () => {
  it("action events do not have a damage property", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result[0].kind).toBe("action")
    expect("damage" in result[0]).toBe(false)
  })
})
