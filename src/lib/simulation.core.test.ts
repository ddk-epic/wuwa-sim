// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { BuffDef } from "#/types/buff"
import type { SustainEvent } from "#/types/simulation-log"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_SUBSTAT,
} from "./loadout/echo-stat-constants"

import { runSimulation } from "./simulation"
import { dmgHit, healHit, tlEntry } from "./simulation.test-fixtures"

const BASE_ER =
  DEFAULT_SUBSTAT_ROLLS.energyRechargePct * ECHO_SUBSTAT.energyRechargePct

const charA: EnrichedCharacter = {
  id: 1,
  name: "Char A",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  maxEnergy: 100,
  forteCap: 100,
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
          category: "Basic Attack",
          value: "100%",
          actionTime: 60,
          damage: [dmgHit(1.5, 5, 2)],
        },
        {
          name: "Stage 2",
          category: "Basic Attack",
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
      type: "Normal Attack",
      stages: [
        {
          name: "Heavy Attack",
          category: "Basic Attack",
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
  sets: ["Test Set"],
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

vi.mock("./loadout/catalog", () => ({
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
  {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
    echoBuild: "4-3-3-1-1",
    cost4Mains: ["cd"],
    cost3Mains: ["elemDmg", "elemDmg"],
  },
  {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
    echoBuild: "4-3-3-1-1",
    cost4Mains: ["cd"],
    cost3Mains: ["elemDmg", "elemDmg"],
  },
  {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
    echoBuild: "4-3-3-1-1",
    cost4Mains: ["cd"],
    cost3Mains: ["elemDmg", "elemDmg"],
  },
]

describe("runSimulation — empty", () => {
  it("returns empty array for empty timeline", () => {
    expect(runSimulation([], emptySlots, emptyLoadouts)).toEqual([])
  })
})

describe("runSimulation — single hit", () => {
  it("produces one action event and one hit event per timeline entry", () => {
    testCharacters = [charA]
    const entry = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
    )
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      kind: "action",
      characterId: 1,
      skillType: "Basic Attack",
      skillName: "Normal Attack",
      frame: 0,
      cumulativeEnergy: 0,
      cumulativeConcerto: 0,
    })
    expect(result[1]).toMatchObject({
      kind: "hit",
      characterId: 1,
      skillType: "Basic Attack",
      skillName: "Normal Attack [hit 1]",
      frame: 0,
      cumulativeEnergy: 5,
      cumulativeConcerto: 2,
      damage: 675,
      activeBuffs: [],
    })
    expect(
      (result[1] as { statsSnapshot: { atkBase: number } }).statsSnapshot,
    ).toMatchObject({ atkBase: 1000 })
  })

  it("rounds damage to whole number", () => {
    testCharacters = [
      { ...charA, stats: { ...charA.stats, max: { hp: 0, atk: 3, def: 0 } } },
    ]
    const entry = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
    )
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({ kind: "hit", damage: 2 })
  })
})

describe("runSimulation — multi-hit stage", () => {
  it("emits one action event then one hit event per DamageEntry with [hit N] suffix", () => {
    testCharacters = [charA]
    const entry = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack.stage-2::basic-attack",
    )
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
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
    const entry = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack.stage-2::basic-attack",
    )
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
    expect(result[1]).toMatchObject({
      cumulativeEnergy: 3,
      cumulativeConcerto: 1,
    })
    expect(result[2]).toMatchObject({
      cumulativeEnergy: 6,
      cumulativeConcerto: 2,
    })
  })

  it("startWithFullEnergy seeds the occupied slot's energy before hits accrue", () => {
    testCharacters = [charA]
    const slots: Slots = [1, null, null]
    const entry = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
    )
    const baseline = runSimulation([entry], slots, emptyLoadouts)
    const seeded = runSimulation([entry], slots, emptyLoadouts, {
      startWithFullEnergy: true,
    })
    const baseHit = baseline[1]
    const seededHit = seeded[1]
    if (baseHit.kind !== "hit" || seededHit.kind !== "hit")
      throw new Error("expected hit rows")
    // charA.maxEnergy === 100: the seeded run's first hit reads 100 higher.
    expect(seededHit.cumulativeEnergy).toBe(baseHit.cumulativeEnergy + 100)
  })
})

describe("runSimulation — multi-character accumulation", () => {
  it("accumulates energy and concerto separately per character", () => {
    testCharacters = [charA, charB]
    const entries = [
      tlEntry(
        1,
        "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
      ),
      tlEntry(
        2,
        "char.char-b.basic-attack.normal-attack.stage-1::basic-attack",
      ),
      tlEntry(
        1,
        "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
        "1-na-2",
      ),
    ]
    const result = runSimulation(entries, emptySlots, emptyLoadouts)
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
      tlEntry(
        1,
        "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
      ),
      tlEntry(
        2,
        "char.char-b.basic-attack.normal-attack.stage-1::basic-attack",
      ),
    ]
    const result = runSimulation(entries, emptySlots, emptyLoadouts)
    expect(result).toHaveLength(4)
    expect(result[1]).toMatchObject({ kind: "hit", damage: 675 })
    expect(result[3]).toMatchObject({ kind: "hit", damage: 338 })
  })
})

describe("runSimulation — echo skill entries", () => {
  it("resolves echo damage entries from the character's equipped echo", () => {
    testCharacters = [charA]
    testEchoes = [echoA]
    const slots: Slots = [1, null, null]
    const loadouts: SlotLoadout[] = [
      {
        weaponId: null,
        weaponRank: 1,
        echoId: 10,
        echoSetSlot1Id: null,
        echoSetSlot2Id: null,
        sequence: 0,
        echoBuild: "4-3-3-1-1",
        cost4Mains: ["cd"],
        cost3Mains: ["elemDmg", "elemDmg"],
      },
      {
        weaponId: null,
        weaponRank: 1,
        echoId: null,
        echoSetSlot1Id: null,
        echoSetSlot2Id: null,
        sequence: 0,
        echoBuild: "4-3-3-1-1",
        cost4Mains: ["cd"],
        cost3Mains: ["elemDmg", "elemDmg"],
      },
      {
        weaponId: null,
        weaponRank: 1,
        echoId: null,
        echoSetSlot1Id: null,
        echoSetSlot2Id: null,
        sequence: 0,
        echoBuild: "4-3-3-1-1",
        cost4Mains: ["cd"],
        cost3Mains: ["elemDmg", "elemDmg"],
      },
    ]
    const entry = tlEntry(1, "echo.echo-one.echo-hit::echo-skill")
    const result = runSimulation([entry], slots, loadouts)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      kind: "action",
      characterId: 1,
      cumulativeConcerto: 0,
      cumulativeEnergy: 0,
    })
    expect(result[1]).toMatchObject({
      kind: "hit",
      damage: 4657,
      cumulativeEnergy: expect.closeTo(10 * (1 + BASE_ER)),
      cumulativeConcerto: 5,
    })
    expect(result[2]).toMatchObject({
      kind: "hit",
      damage: 2328,
      cumulativeEnergy: expect.closeTo(20 * (1 + BASE_ER)),
      cumulativeConcerto: 10,
    })
  })
})

describe("runSimulation — missing character", () => {
  it("skips entries with unknown characterId", () => {
    testCharacters = []
    const entry = tlEntry(
      99,
      "char.unknown.basic-attack.normal-attack.stage-1::basic-attack",
    )
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
    expect(result).toEqual([])
  })
})

describe("runSimulation — unmatched stage", () => {
  it("skips timeline entries whose stage cannot be found", () => {
    testCharacters = [charA]
    const entry = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack.nonexistent::basic-attack",
    )
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
    expect(result).toEqual([])
  })
})

describe("runSimulation — frame tracking", () => {
  it("assigns stageStartFrame to action events and stageStartFrame + actionFrame to hit events", () => {
    testCharacters = [charA]
    const entry1: TimelineEntry = {
      id: "e1",
      characterId: 1,
      stageId: "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
    }
    const entry2: TimelineEntry = {
      id: "e2",
      characterId: 1,
      stageId: "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
    }
    const result = runSimulation([entry1, entry2], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(4)
    expect(result[0].frame).toBe(0)
    expect(result[1].frame).toBe(0)
    expect(result[2].frame).toBe(60)
    expect(result[3].frame).toBe(60)
  })
})

describe("runSimulation — action event concerto", () => {
  it("accumulates stage.concerto on action event without advancing energy", () => {
    testCharacters = [charD]
    const entry: TimelineEntry = {
      id: "d1",
      characterId: 4,
      stageId:
        "char.char-d.basic-attack.heavy-attack.heavy-attack::basic-attack",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
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

describe("runSimulation — stats snapshot", () => {
  it("populates statsSnapshot and empty activeBuffs on every HitEvent", () => {
    testCharacters = [charA]
    const entry = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack.stage-2::basic-attack",
    )
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(2)
    for (const hit of hits) {
      expect(hit.activeBuffs).toEqual([])
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

describe("runSimulation — discriminated union", () => {
  it("action events do not have a damage property", () => {
    testCharacters = [charA]
    const entry = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
    )
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
    expect(result[0].kind).toBe("action")
    expect("damage" in result[0]).toBe(false)
  })
})

// Tracer fixture: Stage 5 with actionFrame=23, cancel.actionTime=33, instantCancel.actionTime=7
// reactionDelay=9: cancel cutoff=42, instantCancel cutoff=16
describe("runSimulation — healing pipeline", () => {
  const healerAtk = 2000

  const charHealer: EnrichedCharacter = {
    id: 20,
    name: "Healer",
    element: "Spectro",
    weaponType: "Rectifier",
    rarity: "5",
    maxEnergy: 100,
    forteCap: 100,
    stats: {
      base: { hp: 0, atk: 0, def: 0 },
      max: { hp: 0, atk: healerAtk, def: 0 },
    },
    template: { weapon: "", echo: "", echoSet: "" },
    skillTreeBonuses: [],
    buffs: [],
    skills: [
      {
        id: 100,
        name: "Heal Skill",
        type: "Resonance Skill",
        stages: [
          {
            name: "Heal Stage",
            category: "Resonance Skill",
            value: "23.8%+950",
            actionTime: 30,
            damage: [healHit(0.238, 950, "team")],
          },
        ],
        damage: [],
      },
    ],
  }

  it("heal stage produces a SustainEvent instead of a HitEvent", () => {
    testCharacters = [charHealer]
    const result = runSimulation(
      [
        tlEntry(
          20,
          "char.healer.resonance-skill.heal-skill.heal-stage::basic-attack",
        ),
      ],
      emptySlots,
      emptyLoadouts,
    )
    const sustain = result.find((e) => e.kind === "sustain")
    expect(sustain).toBeDefined()
    expect(sustain!.sub).toBe("heal")
    expect(result.every((e) => e.kind !== "hit")).toBe(true)
  })

  it("heal amount = (ATK x multiplier + flat) x (1 + healingBonus)", () => {
    testCharacters = [charHealer]
    const result = runSimulation(
      [
        tlEntry(
          20,
          "char.healer.resonance-skill.heal-skill.heal-stage::basic-attack",
        ),
      ],
      emptySlots,
      emptyLoadouts,
    )
    const sustain = result.find((e): e is SustainEvent => e.kind === "sustain")
    const expected = Math.round(healerAtk * 0.238 + 950)
    expect(sustain?.amount).toBe(expected)
  })

  it("team target resolves to all non-null slot character IDs", () => {
    testCharacters = [charHealer]
    const slots: Slots = [20, null, null]
    const result = runSimulation(
      [
        tlEntry(
          20,
          "char.healer.resonance-skill.heal-skill.heal-stage::basic-attack",
        ),
      ],
      slots,
      emptyLoadouts,
    )
    const sustain = result.find((e): e is SustainEvent => e.kind === "sustain")
    expect(sustain?.targets).toEqual([20])
  })

  it("healLanded trigger fires a buff in response to a heal", () => {
    const healBuff: BuffDef = {
      id: "test.heal-triggered-buff",
      name: "Heal Buff",
      trigger: { event: "healLanded", actor: "self" },
      target: { kind: "self" },
      duration: { kind: "frames", v: 60 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    }
    const healerWithBuff: EnrichedCharacter = {
      ...charHealer,
      buffs: [healBuff],
    }
    testCharacters = [healerWithBuff]
    const slots: Slots = [20, null, null]
    const result = runSimulation(
      [
        tlEntry(
          20,
          "char.healer.resonance-skill.heal-skill.heal-stage::basic-attack",
        ),
      ],
      slots,
      emptyLoadouts,
    )
    const buffApplied = result.find((e) => e.kind === "buffApplied")
    expect(buffApplied).toBeDefined()
    expect((buffApplied as { buffId: string }).buffId).toBe(
      "test.heal-triggered-buff",
    )
  })
})

// -- Trailing-window collision (issue #177) -----------------------

// -- Fall frames --------------------------------------------

// -- Trailing-window footing snapshot ---------------------

// -- Footing commit as Trailing Window event ---------------
