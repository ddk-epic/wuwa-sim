import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { HitEvent } from "#/types/simulation-log"

import { generateSimulationLog } from "./simulation-log"

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
    expect(result[1]).toMatchObject({
      cumulativeEnergy: 3,
      cumulativeConcerto: 1,
    })
    expect(result[2]).toMatchObject({
      cumulativeEnergy: 6,
      cumulativeConcerto: 2,
    })
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

describe("generateSimulationLog — buff lifecycle interleaving", () => {
  it("interleaves buffApplied with action/hit events when an Intro Skill grants a Resonance Skill bonus", () => {
    const introBuff = {
      id: "char.intro.buff",
      name: "Intro",
      trigger: {
        event: "skillCast" as const,
        characterId: 1,
        skillType: "Intro Skill",
      },
      target: { kind: "self" as const },
      duration: { kind: "seconds" as const, v: 14 },
      effects: [
        {
          kind: "stat" as const,
          path: { stat: "skillTypeBonus" as const, key: "Resonance Skill" },
          value: { kind: "const" as const, v: 0.5 },
        },
      ],
    }
    const charWithIntro: EnrichedCharacter = {
      ...charA,
      buffs: [introBuff],
      skills: [
        {
          id: 100,
          name: "Intro",
          type: "Intro Skill",
          stages: [
            {
              name: "Skill",
              value: "100%",
              actionTime: 30,
              damage: [dmgHit(1.0, 0, 0)],
            },
          ],
          damage: [],
        },
        {
          id: 101,
          name: "Resonance",
          type: "Resonance Skill",
          stages: [
            {
              name: "Skill",
              value: "100%",
              actionTime: 30,
              damage: [dmgHit(1.0, 0, 0)],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charWithIntro]
    const entries: TimelineEntry[] = [
      tlEntry(1, "Intro Skill", "Intro"),
      tlEntry(1, "Resonance Skill", "Resonance"),
    ]
    const result = generateSimulationLog(
      entries,
      [1, null, null],
      emptyLoadouts,
    )
    const kinds = result.map((e) => e.kind)
    // Expected: buffApplied (from skillCast pre-hit), action, hit (intro hit, no bonus),
    //           action (resonance), hit (with bonus).
    expect(kinds[0]).toBe("buffApplied")
    expect(kinds).toContain("action")
    expect(kinds).toContain("hit")
    const resHit = result.find(
      (e) => e.kind === "hit" && e.skillType === "Resonance Skill",
    ) as HitEvent | undefined
    expect(resHit).toBeDefined()
    expect(resHit?.activeBuffIds).toContain("char.intro.buff")
    expect(resHit?.statsSnapshot.skillTypeBonus["Resonance Skill"]).toBeCloseTo(
      0.5,
    )
  })
})

describe("generateSimulationLog — emitHit pilot (#60)", () => {
  it("synthetic hits appear in the log attributed to the acting character", () => {
    // Char 1 has a coord-attack buff that emits a synthetic Fusion hit each
    // time it lands a Normal Attack (ICD 0).
    const coord = {
      id: "char.coord",
      name: "Coord",
      trigger: {
        event: "hitLanded" as const,
        characterId: 1,
        source: "self" as const,
      },
      target: { kind: "self" as const },
      duration: { kind: "permanent" as const },
      effects: [
        {
          kind: "emitHit" as const,
          damage: dmgHit(0.5),
          icdFrames: 0,
          skillType: "Coordinated Attack",
        },
      ],
    }
    const charWithCoord: EnrichedCharacter = { ...charA, buffs: [coord] }
    testCharacters = [charWithCoord]
    const entry = tlEntry(1, "Normal Attack", "Normal Attack")
    const result = generateSimulationLog(
      [entry],
      [1, null, null],
      emptyLoadouts,
    )
    const hits = result.filter((e) => e.kind === "hit")
    // Authored hit + 1 synthetic hit
    expect(hits).toHaveLength(2)
    const synth = hits.find((h) => h.kind === "hit" && h.synthetic === true)
    expect(synth).toBeDefined()
    if (synth && synth.kind === "hit") {
      expect(synth.characterId).toBe(1)
      expect(synth.sourceBuffId).toBe("char.coord")
      expect(synth.skillType).toBe("Coordinated Attack")
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
