import { afterEach, describe, expect, it, vi } from "vitest"
import type { DamageEntry, EnrichedCharacter } from "#/types/character"
import type { SimulationLogEntry } from "#/types/simulation-log"
import type { TimelineEntry } from "#/types/timeline"

import { emptyStatTable } from "#/types/stat-table"

import { getTimelineSummary } from "./timeline-summary"

const dmgEntry = (value: number, actionFrame = 0): DamageEntry => ({
  type: "Basic Attack",
  dmgType: "Fusion",
  scalingStat: "ATK",
  actionFrame,
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
        {
          name: "",
          category: "Basic Attack",
          value: "1",
          actionTime: 60,
          damage: [dmgEntry(1.5)],
        },
      ],
      damage: [],
    },
    {
      id: 2,
      name: "Heavy Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "",
          category: "Basic Attack",
          value: "1",
          actionTime: 30,
          damage: [dmgEntry(1.0)],
        },
      ],
      damage: [],
    },
    {
      id: 3,
      name: "Resonance Skill",
      type: "Resonance Skill",
      stages: [
        {
          name: "",
          category: "Basic Attack",
          value: "1",
          actionTime: 90,
          damage: [dmgEntry(1.0)],
        },
      ],
      damage: [],
    },
    {
      id: 4,
      name: "No Damage Skill",
      type: "Forte Circuit",
      stages: [
        {
          name: "",
          category: "Basic Attack",
          value: "0",
          actionTime: 60,
          damage: [],
        },
      ],
      damage: [],
    },
    {
      id: 5,
      name: "Instant Skill",
      type: "Resonance Skill",
      stages: [
        {
          name: "",
          category: "Basic Attack",
          value: "1",
          actionTime: 0,
          damage: [dmgEntry(1.0)],
        },
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
        {
          name: "",
          category: "Basic Attack",
          value: "1",
          actionTime: 60,
          damage: [dmgEntry(1.5)],
        },
      ],
      damage: [],
    },
  ],
}

let testCharacters: EnrichedCharacter[] = []

vi.mock("../loadout/catalog", () => ({
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
  const charName = characterId === 2 ? "test-b" : "test-a"
  return tlEntry(
    characterId,
    `char.${charName}.basic-attack.normal-attack._`,
    id,
  )
}

describe("getTimelineSummary — empty", () => {
  it("returns empty rows and zero aggregates for empty Timeline", () => {
    const result = getTimelineSummary([])
    expect(result).toEqual({
      rows: [],
      totalDamage: 0,
      totalTimeFrames: 0,
      dps: 0,
    })
  })
})

describe("getTimelineSummary — single entry", () => {
  it("first row starts at timeFrames 0 with null damage when no simulation log is provided", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([normalAttack(1)])
    expect(result.rows).toEqual([
      {
        timeFrames: 0,
        durationFrames: 60,
        reactFrames: 0,
        floorFrames: 0,
        padFrames: 0,
        fallFrames: 0,
        swapBackFrames: 0,
        damage: null,
        cumulativeConcerto: null,
        cumulativeEnergy: null,
      },
    ])
    expect(result.totalDamage).toBe(0)
    expect(result.totalTimeFrames).toBe(60)
    expect(result.dps).toBe(0)
  })

  it("damage is null when stage has no damage entries", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([
      tlEntry(1, "char.test-a.forte-circuit.no-damage-skill._"),
    ])
    expect(result.rows[0].damage).toBeNull()
    expect(result.totalDamage).toBe(0)
  })
})

describe("getTimelineSummary — multi-entry accumulation", () => {
  it("accumulates timeFrames across entries (in frames)", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([
      normalAttack(1, "a"),
      tlEntry(1, "char.test-a.basic-attack.heavy-attack._", "b"),
      tlEntry(1, "char.test-a.resonance-skill.resonance-skill._", "c"),
    ])
    // Normal Attack: 60f, Heavy Attack: 30f (starts at 60), Resonance Skill: 90f (starts at 90)
    expect(result.rows.map((r) => r.timeFrames)).toEqual([0, 60, 90])
    expect(result.totalTimeFrames).toBe(180)
  })

  it("damage is null for every fallback row regardless of character", () => {
    testCharacters = [charA, charB]
    const result = getTimelineSummary([normalAttack(1), normalAttack(2)])
    expect(result.rows.map((r) => r.damage)).toEqual([null, null])
    expect(result.totalDamage).toBe(0)
  })
})

describe("getTimelineSummary — zero-damage rule", () => {
  it("fallback rows have null damage and totalDamage stays 0, but time still advances", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([
      tlEntry(1, "char.test-a.forte-circuit.no-damage-skill._", "a"),
      normalAttack(1, "b"),
    ])
    expect(result.rows[0].damage).toBeNull()
    expect(result.rows[1].damage).toBeNull()
    expect(result.totalDamage).toBe(0)
    expect(result.totalTimeFrames).toBe(120) // No Damage 60f + Normal Attack 60f
  })
})

describe("getTimelineSummary — dps", () => {
  it("dps is 0 without a simulation log", () => {
    testCharacters = [charA]
    const result = getTimelineSummary([
      tlEntry(1, "char.test-a.resonance-skill.resonance-skill._"),
    ])
    expect(result.totalTimeFrames).toBe(90)
    expect(result.totalDamage).toBe(0)
    expect(result.dps).toBe(0)
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

// â”€â”€ Log ingestion (#187) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function makeActionEvent(
  entryId: string,
  frame: number,
  delayBreakdown?: {
    react: number
    floor: number
    pad: number
    fall: number
    swapBack: number
  },
): Extract<SimulationLogEntry, { kind: "action" }> {
  return {
    kind: "action",
    characterId: 1,
    skillType: "Basic Attack",
    skillName: "Normal Attack",
    frame,
    cumulativeEnergy: 0,
    cumulativeConcerto: 0,
    sourceEntryId: entryId,
    ...(delayBreakdown !== undefined ? { delayBreakdown } : {}),
  }
}

function makeHitEvent(
  entryId: string,
  frame: number,
  damage: number,
  cumulatives?: { cumulativeConcerto?: number; cumulativeEnergy?: number },
): Extract<SimulationLogEntry, { kind: "hit" }> {
  return {
    kind: "hit",
    characterId: 1,
    skillType: "Basic Attack",
    skillName: "Normal Attack [hit 1]",
    frame,
    cumulativeEnergy: cumulatives?.cumulativeEnergy ?? 0,
    cumulativeConcerto: cumulatives?.cumulativeConcerto ?? 0,
    damage,
    element: "Fusion",
    dmgType: "Fusion",
    multiplier: 1,
    statsSnapshot: { ...emptyStatTable(), atkBase: 1000 },
    activeBuffs: [],
    passiveBuffs: [],
    sourceEntryId: entryId,
  }
}

describe("getTimelineSummary — log ingestion: all rows matched", () => {
  it("reads timeFrames, reactFrames, padFrames from ActionEvents when all entries are matched", () => {
    testCharacters = [charA]
    const e1 = normalAttack(1, "e1")
    const e2 = normalAttack(1, "e2")

    const log: SimulationLogEntry[] = [
      makeActionEvent("e1", 0),
      makeHitEvent("e1", 0, 900),
      makeActionEvent("e2", 60, {
        react: 9,
        floor: 0,
        pad: 0,
        fall: 0,
        swapBack: 0,
      }),
      makeHitEvent("e2", 60, 1200),
    ]

    const result = getTimelineSummary([e1, e2], undefined, undefined, 9, 6, log)
    expect(result.rows[0]).toMatchObject({
      timeFrames: 0,
      durationFrames: 60,
      reactFrames: 0,
      padFrames: 0,
      damage: 900,
    })
    expect(result.rows[1]).toMatchObject({
      timeFrames: 60,
      reactFrames: 9,
      padFrames: 0,
      damage: 1200,
    })
    expect(result.totalDamage).toBe(2100)
    expect(result.totalTimeFrames).toBe(60 + result.rows[1].durationFrames)
  })
})

describe("getTimelineSummary — log ingestion: mixed match/fallback", () => {
  it("fallback row after matched rows uses cumulative durationFrames for timeFrames", () => {
    testCharacters = [charA]
    const e1 = normalAttack(1, "e1")
    const e2 = normalAttack(1, "e2") // added after sim — no ActionEvent in log

    const log: SimulationLogEntry[] = [
      makeActionEvent("e1", 0),
      makeHitEvent("e1", 0, 900),
    ]

    const result = getTimelineSummary([e1, e2], undefined, undefined, 9, 6, log)
    // e1 matched: timeFrames=0, durationFrames=60 (stage-math for last matched row)
    expect(result.rows[0]).toMatchObject({
      timeFrames: 0,
      durationFrames: 60,
      damage: 900,
    })
    // e2 fallback: timeFrames = cumulative = 60
    expect(result.rows[1]).toMatchObject({
      timeFrames: 60,
      durationFrames: 60,
      reactFrames: 0,
      padFrames: 0,
      damage: null, // fallback rows show no estimate
    })
  })
})

describe("getTimelineSummary — log ingestion: trailing-window damage", () => {
  it("sums hit damage by sourceEntryId, attributing trailing-window hits to swap entry", () => {
    testCharacters = [charA]
    const swapEntry: TimelineEntry = {
      id: "swap-e",
      characterId: 1,
      stageId: "char.test-a.basic-attack.normal-attack._",
      variantKind: "swap",
    }
    const nextEntry = normalAttack(1, "next-e")

    // swap-e: action at frame 0, advance=6; trailing hit lands at frame 15
    // next-e: action at frame 6, advance=60
    const log: SimulationLogEntry[] = [
      makeActionEvent("swap-e", 0),
      makeHitEvent("swap-e", 3, 300), // immediate hit
      makeActionEvent("next-e", 6),
      makeHitEvent("swap-e", 15, 200), // trailing hit attributed to swap-e
      makeHitEvent("next-e", 6, 400),
    ]

    const result = getTimelineSummary(
      [swapEntry, nextEntry],
      undefined,
      undefined,
      9,
      6,
      log,
    )
    // swap-e: damage = 300 + 200 = 500 (both hits attributed to it)
    expect(result.rows[0].damage).toBe(500)
    // next-e: damage = 400
    expect(result.rows[1].damage).toBe(400)
    expect(result.totalDamage).toBe(900)
  })
})

describe("getTimelineSummary — post-stage cumulatives", () => {
  it("uses last hit event cumulatives when hits exist for the entry", () => {
    testCharacters = [charA]
    const e1 = normalAttack(1, "e1")
    const log: SimulationLogEntry[] = [
      makeActionEvent("e1", 0),
      makeHitEvent("e1", 5, 100, {
        cumulativeConcerto: 20,
        cumulativeEnergy: 10,
      }),
      makeHitEvent("e1", 10, 200, {
        cumulativeConcerto: 40,
        cumulativeEnergy: 20,
      }),
    ]
    const result = getTimelineSummary([e1], undefined, undefined, 9, 6, log)
    // last hit wins, not the action event (which has 0/0)
    expect(result.rows[0].cumulativeConcerto).toBe(40)
    expect(result.rows[0].cumulativeEnergy).toBe(20)
  })

  it("falls back to action event cumulatives when no hits exist for the entry", () => {
    testCharacters = [charA]
    const e1 = normalAttack(1, "e1")
    const actionEvent = {
      kind: "action" as const,
      characterId: 1,
      skillType: "Basic Attack" as const,
      skillName: "Normal Attack",
      frame: 0,
      cumulativeConcerto: 15,
      cumulativeEnergy: 8,
      sourceEntryId: "e1",
    }
    const log: SimulationLogEntry[] = [actionEvent]
    const result = getTimelineSummary([e1], undefined, undefined, 9, 6, log)
    expect(result.rows[0].cumulativeConcerto).toBe(15)
    expect(result.rows[0].cumulativeEnergy).toBe(8)
  })

  it("returns null cumulatives for entries with no action event in the log", () => {
    testCharacters = [charA]
    const e1 = normalAttack(1, "e1")
    const result = getTimelineSummary([e1], undefined, undefined, 9, 6, [])
    expect(result.rows[0].cumulativeConcerto).toBeNull()
    expect(result.rows[0].cumulativeEnergy).toBeNull()
  })

  it("collapsed group header value equals last entry row value (post-stage)", () => {
    // Verified at summary level: the same row the header would read from
    testCharacters = [charA]
    const e1 = normalAttack(1, "e1")
    const e2 = normalAttack(1, "e2")
    const log: SimulationLogEntry[] = [
      makeActionEvent("e1", 0),
      makeHitEvent("e1", 5, 100, {
        cumulativeConcerto: 25,
        cumulativeEnergy: 12,
      }),
      makeActionEvent("e2", 60),
      makeHitEvent("e2", 65, 200, {
        cumulativeConcerto: 50,
        cumulativeEnergy: 24,
      }),
    ]
    const result = getTimelineSummary([e1, e2], undefined, undefined, 9, 6, log)
    // last entry row (index 1) drives collapsed header display
    expect(result.rows[1].cumulativeConcerto).toBe(50)
    expect(result.rows[1].cumulativeEnergy).toBe(24)
  })
})

describe("getTimelineSummary — variantFloor / floorFrames", () => {
  it("floorFrames=0 and reactFrames=reactionDelay when react wins", () => {
    testCharacters = [charA]
    const e1 = normalAttack(1, "e1")
    const log: SimulationLogEntry[] = [
      makeActionEvent("e1", 0, {
        react: 9,
        floor: 0,
        pad: 0,
        fall: 0,
        swapBack: 0,
      }),
    ]
    const result = getTimelineSummary([e1], undefined, undefined, 9, 6, log, 6)
    expect(result.rows[0].reactFrames).toBe(9)
    expect(result.rows[0].floorFrames).toBe(0)
  })

  it("floorFrames=variantFloor and reactFrames=0 when floor wins", () => {
    testCharacters = [charA]
    const e1 = normalAttack(1, "e1")
    const log: SimulationLogEntry[] = [
      makeActionEvent("e1", 0, {
        react: 0,
        floor: 15,
        pad: 0,
        fall: 0,
        swapBack: 0,
      }),
    ]
    const result = getTimelineSummary([e1], undefined, undefined, 9, 6, log, 15)
    expect(result.rows[0].reactFrames).toBe(0)
    expect(result.rows[0].floorFrames).toBe(15)
  })

  it("fallback path: floorFrames from resolveStageExecution when floor wins", () => {
    // charA has Normal Attack with actionTime=60, no cancel variant
    // With no log, fallback to resolveStageExecution with variantFloor=0 â†’ react wins
    testCharacters = [charA]
    const entry: TimelineEntry = {
      id: "f1",
      characterId: 1,
      stageId: "char.test-a.basic-attack.normal-attack._",
      variantKind: undefined,
    }
    const result = getTimelineSummary(
      [entry],
      undefined,
      undefined,
      9,
      6,
      undefined,
      0,
    )
    expect(result.rows[0].floorFrames).toBe(0)
    expect(result.rows[0].reactFrames).toBe(0)
  })
})
