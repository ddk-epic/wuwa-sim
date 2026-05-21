import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  DamageEntry,
  EnrichedCharacter,
  HealTarget,
  SkillType,
} from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { BuffDef } from "#/types/buff"
import type {
  ActionEvent,
  HitEvent,
  SustainEvent,
} from "#/types/simulation-log"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_BUILD_LAYOUT,
  ECHO_MAIN_3COST_VARIABLE,
  ECHO_SUBSTAT,
} from "./loadout/echo-stat-constants"

import { runSimulation } from "./simulation"

const BASE_ER =
  DEFAULT_SUBSTAT_ROLLS.energyRechargePct * ECHO_SUBSTAT.energyRechargePct
const BASE_ELEM_BONUS =
  ECHO_BUILD_LAYOUT["4-3-3-1-1"].cost3 * ECHO_MAIN_3COST_VARIABLE.elemDmg

const dmgHit = (
  value: number,
  energy = 0,
  concerto = 0,
  type: SkillType = "Basic Attack",
): DamageEntry => ({
  type,
  dmgType: "Fusion",
  scalingStat: "atk",
  actionFrame: 0,
  value,
  energy,
  concerto,
  toughness: 0,
  weakness: 0,
})

const healHit = (
  value: number,
  flat = 0,
  target: HealTarget = "self",
  type: SkillType = "Basic Attack",
): DamageEntry => ({
  type,
  dmgType: "Heal",
  scalingStat: "ATK",
  actionFrame: 0,
  flat,
  value,
  energy: 0,
  concerto: 0,
  toughness: 0,
  weakness: 0,
  target,
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
          actionTime: 60,
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

function tlEntry(
  characterId: number,
  stageId: string,
  id = `${characterId}-${stageId}`,
): TimelineEntry {
  return { id, characterId, stageId }
}

describe("runSimulation — empty", () => {
  it("returns empty array for empty timeline", () => {
    expect(runSimulation([], emptySlots, emptyLoadouts)).toEqual([])
  })
})

describe("runSimulation — single hit", () => {
  it("produces one action event and one hit event per timeline entry", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack::_")
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
    const entry = tlEntry(1, "Normal Attack::_")
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({ kind: "hit", damage: 2 })
  })
})

describe("runSimulation — multi-hit stage", () => {
  it("emits one action event then one hit event per DamageEntry with [hit N] suffix", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack::(Stage 2)")
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
    const entry = tlEntry(1, "Normal Attack::(Stage 2)")
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
})

describe("runSimulation — multi-character accumulation", () => {
  it("accumulates energy and concerto separately per character", () => {
    testCharacters = [charA, charB]
    const entries = [
      tlEntry(1, "Normal Attack::_"),
      tlEntry(2, "Normal Attack::_"),
      tlEntry(1, "Normal Attack::_", "1-na-2"),
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
      tlEntry(1, "Normal Attack::_"),
      tlEntry(2, "Normal Attack::_"),
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
    const entry = tlEntry(1, "Echo One::Hit")
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
    const entry = tlEntry(99, "Normal Attack::_")
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
    expect(result).toEqual([])
  })
})

describe("runSimulation — unmatched stage", () => {
  it("skips timeline entries whose stage cannot be found", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack::Nonexistent")
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
      stageId: "Normal Attack::_",
    }
    const entry2: TimelineEntry = {
      id: "e2",
      characterId: 1,
      stageId: "Normal Attack::_",
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
      stageId: "Heavy Attack::_",
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
    const entry = tlEntry(1, "Normal Attack::(Stage 2)")
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

describe("runSimulation — buff lifecycle interleaving", () => {
  it("interleaves buffApplied with action/hit events when an Intro Skill grants a Resonance Skill bonus", () => {
    const introBuff: BuffDef = {
      id: "char.intro.buff",
      name: "Intro",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Intro Skill",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 14 },
      effects: [
        {
          kind: "stat",
          path: { stat: "skillTypeBonus", key: "Resonance Skill" },
          value: { kind: "const", v: 0.5 },
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
              damage: [dmgHit(1.0, 0, 0, "Intro Skill")],
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
              damage: [dmgHit(1.0, 0, 0, "Resonance Skill")],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charWithIntro]
    const entries: TimelineEntry[] = [
      tlEntry(1, "Intro::_"),
      tlEntry(1, "Resonance::_"),
    ]
    const result = runSimulation(entries, [1, null, null], emptyLoadouts)
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
    expect(resHit?.activeBuffs.some((b) => b.id === "char.intro.buff")).toBe(
      true,
    )
    expect(resHit?.statsSnapshot.skillTypeBonus["Resonance Skill"]).toBeCloseTo(
      0.5,
    )
  })
})

describe("runSimulation — emitHit pilot (#60)", () => {
  it("synthetic hits appear in the log attributed to the acting character", () => {
    // Char 1 has a coord-attack buff that emits a synthetic Fusion hit each
    // time it lands a Normal Attack (ICD 0).
    const coord: BuffDef = {
      id: "char.coord",
      name: "Coord",
      trigger: {
        event: "hitLanded",
        characterId: 1,
        source: "self",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: dmgHit(0.5),
          icdFrames: 0,
          skillType: "Basic Attack",
        },
      ],
    }
    const charWithCoord: EnrichedCharacter = { ...charA, buffs: [coord] }
    testCharacters = [charWithCoord]
    const entry = tlEntry(1, "Normal Attack::_")
    const result = runSimulation([entry], [1, null, null], emptyLoadouts)
    const hits = result.filter((e) => e.kind === "hit")
    // Authored hit + 1 synthetic hit
    expect(hits).toHaveLength(2)
    const synth = hits.find((h) => h.synthetic === true)
    expect(synth).toBeDefined()
    if (synth) {
      expect(synth.characterId).toBe(1)
      expect(synth.sourceBuffId).toBe("char.coord")
      expect(synth.skillType).toBe("Basic Attack")
    }
  })
})

describe("runSimulation — discriminated union", () => {
  it("action events do not have a damage property", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack::_")
    const result = runSimulation([entry], emptySlots, emptyLoadouts)
    expect(result[0].kind).toBe("action")
    expect("damage" in result[0]).toBe(false)
  })
})

// Tracer fixture: Stage 5 with actionFrame=23, cancel.actionTime=33, instantCancel.actionTime=7
// reactionDelay=9: cancel cutoff=42, instantCancel cutoff=16
const charVariant: EnrichedCharacter = {
  id: 10,
  name: "Variant Char",
  element: "Glacio",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 5,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage 5",
          value: "233.81%",
          actionTime: 50,
          variants: {
            cancel: { actionTime: 33 },
            instantCancel: { actionTime: 7 },
          },
          damage: [
            {
              type: "Basic Attack",
              dmgType: "Glacio",
              scalingStat: "ATK",
              actionFrame: 23,
              value: 2.3381,
              energy: 4.2,
              concerto: 10,
              toughness: 1.68,
              weakness: 1.344,
            },
          ],
        },
      ],
      damage: [],
    },
  ],
}

describe("runSimulation — stage variants (ADR 0008)", () => {
  it("full stage (no variantKind): damage entry lands", () => {
    testCharacters = [charVariant]
    const entry = tlEntry(10, "Normal Attack::_")
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 9)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(1)
  })

  it("cancel variant: actionFrame 23 ≤ cutoff 42, damage lands", () => {
    testCharacters = [charVariant]
    const entry: TimelineEntry = {
      id: "v1",
      characterId: 10,
      stageId: "Normal Attack::_",
      variantKind: "cancel",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 9)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(1)
  })

  it("instantCancel: actionFrame 23 > cutoff 16, no damage but skillCast fires", () => {
    testCharacters = [charVariant]
    const entry: TimelineEntry = {
      id: "v2",
      characterId: 10,
      stageId: "Normal Attack::_",
      variantKind: "instantCancel",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 9)
    const hits = result.filter((e) => e.kind === "hit")
    const actions = result.filter((e) => e.kind === "action")
    expect(hits).toHaveLength(0)
    expect(actions).toHaveLength(1)
  })

  it("ActionEvent records variantKind when set", () => {
    testCharacters = [charVariant]
    const entry: TimelineEntry = {
      id: "v3",
      characterId: 10,
      stageId: "Normal Attack::_",
      variantKind: "cancel",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 9)
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.variantKind).toBe("cancel")
  })

  it("ActionEvent has no variantKind for full stage", () => {
    testCharacters = [charVariant]
    const entry = tlEntry(10, "Normal Attack::_")
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 9)
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.variantKind).toBeUndefined()
  })

  it("swap variant with authored actionTime: advance = actionTime + reactionDelay", () => {
    const charSwapAuthored: EnrichedCharacter = {
      ...charVariant,
      id: 11,
      skills: [
        {
          id: 6,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              value: "100%",
              actionTime: 50,
              variants: {
                swap: { actionTime: 10 },
              },
              damage: [
                {
                  type: "Basic Attack",
                  dmgType: "Damage",
                  scalingStat: "ATK",
                  actionFrame: 23,
                  value: 1.0,
                  energy: 0,
                  concerto: 0,
                  toughness: 0,
                  weakness: 0,
                },
              ],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charSwapAuthored]
    const entry: TimelineEntry = {
      id: "sw1",
      characterId: 11,
      stageId: "Normal Attack::_",
      variantKind: "swap",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 6, 6)
    const hits = result.filter((e) => e.kind === "hit")
    // actionFrame 23 > advance 16 but swap does NOT filter — hit lands
    expect(hits).toHaveLength(1)
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.variantKind).toBe("swap")
  })

  it("swap variant with no authored swap: advance = swapFrames, hits unfiltered", () => {
    const charSwapFallback: EnrichedCharacter = {
      ...charVariant,
      id: 12,
      skills: [
        {
          id: 7,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              value: "100%",
              actionTime: 50,
              damage: [
                {
                  type: "Basic Attack",
                  dmgType: "Damage",
                  scalingStat: "ATK",
                  actionFrame: 40,
                  value: 1.0,
                  energy: 0,
                  concerto: 0,
                  toughness: 0,
                  weakness: 0,
                },
              ],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charSwapFallback]
    const entry: TimelineEntry = {
      id: "sw2",
      characterId: 12,
      stageId: "Normal Attack::_",
      variantKind: "swap",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 6, 6)
    const hits = result.filter((e) => e.kind === "hit")
    // actionFrame 40 > swapFrames 6 but swap does NOT filter — hit lands
    expect(hits).toHaveLength(1)
  })
})

describe("runSimulation — skillType derivation from damage[0].type", () => {
  const libHit = (type: SkillType) => ({
    type,
    dmgType: "Damage",
    scalingStat: "ATK",
    actionFrame: 10,
    value: 1.0,
    energy: 1,
    concerto: 1,
    toughness: 0,
    weakness: 0,
  })

  const charWithLiberation: EnrichedCharacter = {
    id: 50,
    name: "Liberation Char",
    element: "Fusion",
    weaponType: "Sword",
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
        id: 500,
        name: "Liberation",
        type: "Resonance Liberation",
        stages: [
          {
            name: "Frolicking Stage",
            newName: "Frolicking Stage",
            value: "100%",
            actionTime: 30,
            damage: [libHit("Basic Attack")],
          },
          {
            name: "Rampage Stage",
            newName: "Rampage Stage",
            value: "100%",
            actionTime: 30,
            damage: [libHit("Resonance Skill")],
          },
        ],
        damage: [],
      },
    ],
  }

  it("skillType on action event is damage[0].type — Frolicking Stage reports Basic Attack", () => {
    testCharacters = [charWithLiberation]
    const result = runSimulation(
      [tlEntry(50, "Liberation::Frolicking Stage")],
      emptySlots,
      emptyLoadouts,
    )
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.skillType).toBe("Basic Attack")
  })

  it("skillType on action event is damage[0].type — Rampage Stage reports Resonance Skill", () => {
    testCharacters = [charWithLiberation]
    const result = runSimulation(
      [tlEntry(50, "Liberation::Rampage Stage")],
      emptySlots,
      emptyLoadouts,
    )
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.skillType).toBe("Resonance Skill")
  })

  it("skillCast trigger fires on skill type derived from damage[0].type", () => {
    const buff: BuffDef = {
      id: "test.cheer-dance",
      name: "Cheer Dance",
      trigger: {
        event: "skillCast",
        characterId: 50,
        skillType: "Resonance Skill",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    const charWithBuff: EnrichedCharacter = {
      ...charWithLiberation,
      buffs: [buff],
    }
    testCharacters = [charWithBuff]
    const result = runSimulation(
      [
        tlEntry(50, "Liberation::Frolicking Stage"),
        tlEntry(50, "Liberation::Rampage Stage"),
      ],
      [50, null, null],
      emptyLoadouts,
    )
    const buffApplied = result.find(
      (e) => e.kind === "buffApplied" && e.buffId === "test.cheer-dance",
    )
    expect(buffApplied).toBeDefined()
    const frolickingHit = result.find(
      (e) => e.kind === "hit" && e.skillType === "Basic Attack",
    ) as HitEvent | undefined
    expect(frolickingHit?.statsSnapshot.elementBonus["Fusion"]).toBeCloseTo(
      BASE_ELEM_BONUS,
    )
    const rampageHit = result.find(
      (e) => e.kind === "hit" && e.skillType === "Resonance Skill",
    ) as HitEvent | undefined
    expect(rampageHit?.statsSnapshot.elementBonus["Fusion"]).toBeCloseTo(
      0.1 + BASE_ELEM_BONUS,
    )
  })

  it("hitLanded trigger uses per-hit type — Basic Attack trigger fires on Basic Attack hits only", () => {
    const s1: BuffDef = {
      id: "test.s1",
      name: "S1",
      trigger: {
        event: "hitLanded",
        actor: "self",
        skillType: "Basic Attack",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 6 },
      stacking: { max: 4, onRetrigger: "addStack" },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "perStack", v: 0.03 },
        },
      ],
    }
    const charWithHeavy: EnrichedCharacter = {
      id: 51,
      name: "Heavy Char",
      element: "Fusion",
      weaponType: "Sword",
      rarity: "5",
      stats: {
        base: { hp: 0, atk: 0, def: 0 },
        max: { hp: 0, atk: 1000, def: 0 },
      },
      template: { weapon: "", echo: "", echoSet: "" },
      skillTreeBonuses: [],
      buffs: [s1],
      skills: [
        {
          id: 510,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage 1",
              value: "100%",
              actionTime: 30,
              damage: [libHit("Basic Attack")],
            },
            {
              name: "Heavy Attack",
              newName: "Heavy Attack",
              value: "200%",
              actionTime: 30,
              damage: [libHit("Heavy Attack")],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charWithHeavy]

    // After a Basic Attack hit, S1 is applied. The NEXT hit sees S1 active.
    const basicThenBasicResult = runSimulation(
      [tlEntry(51, "Normal Attack::_"), tlEntry(51, "Normal Attack::_", "2")],
      [51, null, null],
      emptyLoadouts,
    )
    const secondBasicHit = basicThenBasicResult
      .filter((e) => e.kind === "hit")
      .at(1)
    expect(secondBasicHit?.activeBuffs.some((b) => b.id === "test.s1")).toBe(
      true,
    )

    // Heavy Attack hits do NOT trigger S1 — the buff remains absent.
    const heavyResult = runSimulation(
      [tlEntry(51, "Normal Attack::Heavy Attack")],
      [51, null, null],
      emptyLoadouts,
    )
    const heavyHit = heavyResult.find((e) => e.kind === "hit")
    expect(heavyHit?.activeBuffs.some((b) => b.id === "test.s1")).toBe(false)
  })
})

describe("runSimulation — stageId trigger filter (#89)", () => {
  const hit = (): DamageEntry => ({
    type: "Basic Attack",
    dmgType: "Damage",
    scalingStat: "ATK",
    actionFrame: 10,
    value: 1.0,
    energy: 0,
    concerto: 0,
    toughness: 0,
    weakness: 0,
  })

  const charWithTwoStages: EnrichedCharacter = {
    id: 60,
    name: "Stage Char",
    element: "Fusion",
    weaponType: "Sword",
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
        id: 600,
        name: "Skill A",
        type: "Resonance Liberation",
        stages: [
          {
            name: "Stage Alpha",
            newName: "Stage Alpha",
            value: "100%",
            actionTime: 20,
            damage: [hit()],
          },
          {
            name: "Stage Beta",
            newName: "Stage Beta",
            value: "100%",
            actionTime: 20,
            damage: [hit()],
          },
        ],
        damage: [],
      },
    ],
  }

  it("single stageId — buff fires only on matching stage", () => {
    const buff: BuffDef = {
      id: "test.stage-alpha-only",
      name: "Alpha Only",
      trigger: {
        event: "skillCast",
        characterId: 60,
        stageId: "Skill A::Stage Alpha",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.15 },
        },
      ],
    }
    testCharacters = [{ ...charWithTwoStages, buffs: [buff] }]

    const alphaResult = runSimulation(
      [tlEntry(60, "Skill A::Stage Alpha")],
      [60, null, null],
      emptyLoadouts,
    )
    const alphaHit = alphaResult.find((e) => e.kind === "hit")
    expect(
      alphaHit?.activeBuffs.some((b) => b.id === "test.stage-alpha-only"),
    ).toBe(true)

    const betaResult = runSimulation(
      [tlEntry(60, "Skill A::Stage Beta")],
      [60, null, null],
      emptyLoadouts,
    )
    const betaHit = betaResult.find((e) => e.kind === "hit")
    expect(
      betaHit?.activeBuffs.some((b) => b.id === "test.stage-alpha-only"),
    ).toBe(false)
  })

  it("array stageId — buff fires on any of the listed stages", () => {
    const buff: BuffDef = {
      id: "test.both-stages",
      name: "Both Stages",
      trigger: {
        event: "skillCast",
        characterId: 60,
        stageId: ["Skill A::Stage Alpha", "Skill A::Stage Beta"],
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [{ ...charWithTwoStages, buffs: [buff] }]

    for (const stageId of ["Skill A::Stage Alpha", "Skill A::Stage Beta"]) {
      const result = runSimulation(
        [tlEntry(60, stageId)],
        [60, null, null],
        emptyLoadouts,
      )
      const h = result.find((e) => e.kind === "hit")
      expect(h?.activeBuffs.some((b) => b.id === "test.both-stages")).toBe(true)
    }
  })

  it("no stageId filter — buff fires on all stages as before", () => {
    const buff: BuffDef = {
      id: "test.any-stage",
      name: "Any Stage",
      trigger: { event: "skillCast", characterId: 60 },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [{ ...charWithTwoStages, buffs: [buff] }]

    for (const stageId of ["Skill A::Stage Alpha", "Skill A::Stage Beta"]) {
      const result = runSimulation(
        [tlEntry(60, stageId)],
        [60, null, null],
        emptyLoadouts,
      )
      const h = result.find((e) => e.kind === "hit")
      expect(h?.activeBuffs.some((b) => b.id === "test.any-stage")).toBe(true)
    }
  })
})

describe("runSimulation — Energy Recharge (#98)", () => {
  const erBuff = (id: number, erPct: number): BuffDef => ({
    id: `char${id}.er`,
    name: "ER Buff",
    trigger: { event: "simStart" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [
      {
        kind: "stat",
        path: { stat: "energyRechargePct" },
        value: { kind: "const", v: erPct },
      },
    ],
  })

  it("authored hit energy scaled by (1 + actor.energyRechargePct)", () => {
    // charA has base energy=5 per hit; with 50% ER buff + substat baseline ER
    const charWithER: EnrichedCharacter = { ...charA, buffs: [erBuff(1, 0.5)] }
    testCharacters = [charWithER]
    const result = runSimulation(
      [tlEntry(1, "Normal Attack::_")],
      [1, null, null],
      emptyLoadouts,
    )
    const hit = result.find((e) => e.kind === "hit")
    expect(hit?.cumulativeEnergy).toBeCloseTo(5 * (1 + 0.5 + BASE_ER))
  })

  it("no explicit ER buff: only substat baseline ER scales energy", () => {
    testCharacters = [charA]
    const result = runSimulation(
      [tlEntry(1, "Normal Attack::_")],
      [1, null, null],
      emptyLoadouts,
    )
    const hit = result.find((e) => e.kind === "hit")
    expect(hit?.cumulativeEnergy).toBeCloseTo(5 * (1 + BASE_ER))
  })

  it("synthetic hit uses buff-owner ER, not on-field character ER", () => {
    // Char 1: on-field, no ER
    // Char 2: off-field, 50% ER; has an emitHit buff that fires on char1 hits
    //         with energy=10. Char 2 should credit 15, not 10.
    const coordBuff: BuffDef = {
      id: "char2.coord",
      name: "Coord",
      trigger: {
        event: "hitLanded",
        characterId: 1,
        actor: "any",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: { ...dmgHit(0.5, 10), dmgType: "Fusion" },
          icdFrames: 0,
          skillType: "Basic Attack",
        },
      ],
    }
    // Char 1's authored hit has energy=0 so no shared energy flows to char 2;
    // only the synthetic hit contributes energy to char 2 (10 * 1.5 = 15).
    const charOnField: EnrichedCharacter = {
      ...charA,
      id: 1,
      buffs: [],
      skills: [
        {
          ...charA.skills[0],
          stages: [
            { ...charA.skills[0].stages[0], damage: [dmgHit(1.5, 0, 0)] },
          ],
        },
      ],
    }
    const charOffField: EnrichedCharacter = {
      ...charA,
      id: 2,
      buffs: [coordBuff, erBuff(2, 0.5)],
    }
    testCharacters = [charOnField, charOffField]
    const result = runSimulation(
      [tlEntry(1, "Normal Attack::_")],
      [1, 2, null],
      emptyLoadouts,
    )
    const synth = result.find((e) => e.kind === "hit" && e.synthetic) as
      | HitEvent
      | undefined
    expect(synth).toBeDefined()
    // Char 2 credited energy: 10 * (1 + 0.5 + BASE_ER); buff-owner ER, not on-field char ER
    expect(synth?.cumulativeEnergy).toBeCloseTo(10 * (1 + 0.5 + BASE_ER))
  })
})

describe("runSimulation — Movement stages", () => {
  const charWithMovement: EnrichedCharacter = {
    id: 99,
    name: "Movement Char",
    element: "Fusion",
    weaponType: "Sword",
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
        id: 991,
        name: "Normal Attack",
        type: "Normal Attack",
        stages: [
          {
            name: "Stage 1",
            value: "100%",
            actionTime: 60,
            damage: [dmgHit(1.5, 10, 5)],
          },
        ],
        damage: [],
      },
      {
        id: 992,
        name: "Dodge",
        type: "Movement",
        stages: [
          {
            name: "Dodge",
            value: "",
            actionTime: 21,
            damage: [],
          },
        ],
        damage: [],
      },
    ],
  }

  it("Dodge produces an Action Event in the log", () => {
    testCharacters = [charWithMovement]
    const result = runSimulation(
      [tlEntry(99, "Dodge::_")],
      emptySlots,
      emptyLoadouts,
    )
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action).toBeDefined()
    expect(action?.skillType).toBe("Movement")
    expect(action?.frame).toBe(0)
  })

  it("Dodge produces only an Action Event — no hit events", () => {
    testCharacters = [charWithMovement]
    const result = runSimulation(
      [tlEntry(99, "Dodge::_")],
      emptySlots,
      emptyLoadouts,
    )
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(0)
  })

  it("concerto stays unchanged across a Dodge (no skillCast dispatch)", () => {
    testCharacters = [charWithMovement]
    const result = runSimulation(
      [
        tlEntry(99, "Normal Attack::_"), // gains concerto from hit
        tlEntry(99, "Dodge::_"),
      ],
      emptySlots,
      emptyLoadouts,
    )
    // After Normal Attack hits: concerto accumulated; the Dodge action event shows
    // the same concerto (Dodge did not apply any concerto delta)
    const hits = result.filter((e): e is HitEvent => e.kind === "hit")
    const hitAfterNormal = hits[0]
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const dodgeAction = actions.find((a) => a.skillType === "Movement")
    expect(hitAfterNormal?.cumulativeConcerto).toBeGreaterThan(0)
    expect(dodgeAction?.cumulativeConcerto).toBe(
      hitAfterNormal?.cumulativeConcerto,
    )
  })

  it("energy is preserved across a Dodge (Liberation energy not drained)", () => {
    testCharacters = [charWithMovement]
    const result = runSimulation(
      [
        tlEntry(99, "Normal Attack::_"), // accumulates energy via hit
        tlEntry(99, "Dodge::_"),
      ],
      emptySlots,
      emptyLoadouts,
    )
    // Energy set by the hit event; the Dodge action event must show same value
    const hits = result.filter((e): e is HitEvent => e.kind === "hit")
    const hitAfterNormal = hits[0]
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const dodgeAction = actions.find((a) => a.skillType === "Movement")
    expect(hitAfterNormal?.cumulativeEnergy).toBeGreaterThan(0)
    expect(dodgeAction?.cumulativeEnergy).toBe(hitAfterNormal?.cumulativeEnergy)
  })

  it("skillCast-triggered buff does not promote when Dodge is cast", () => {
    const skillCastBuff: BuffDef = {
      id: "test.on-cast",
      name: "On Cast Buff",
      trigger: { event: "skillCast", characterId: 99, skillType: "Movement" },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.5 },
        },
      ],
    }
    const charWithBuff: EnrichedCharacter = {
      ...charWithMovement,
      buffs: [skillCastBuff],
    }
    testCharacters = [charWithBuff]
    const result = runSimulation(
      [tlEntry(99, "Dodge::_")],
      emptySlots,
      emptyLoadouts,
    )
    const buffEvents = result.filter((e) => e.kind === "buffApplied")
    expect(buffEvents).toHaveLength(0)
  })
})

describe("runSimulation — healing pipeline", () => {
  const healerAtk = 2000

  const charHealer: EnrichedCharacter = {
    id: 20,
    name: "Healer",
    element: "Spectro",
    weaponType: "Rectifier",
    rarity: "5",
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
      [tlEntry(20, "Heal Skill::_")],
      emptySlots,
      emptyLoadouts,
    )
    const sustain = result.find((e) => e.kind === "sustain")
    expect(sustain).toBeDefined()
    expect(sustain!.sub).toBe("heal")
    expect(result.every((e) => e.kind !== "hit")).toBe(true)
  })

  it("heal amount = (ATK × multiplier + flat) × (1 + healingBonus)", () => {
    testCharacters = [charHealer]
    const result = runSimulation(
      [tlEntry(20, "Heal Skill::_")],
      emptySlots,
      emptyLoadouts,
    )
    const sustain = result.find((e) => e.kind === "sustain") as SustainEvent
    const expected = Math.round(healerAtk * 0.238 + 950)
    expect(sustain.amount).toBe(expected)
  })

  it("team target resolves to all non-null slot character IDs", () => {
    testCharacters = [charHealer]
    const slots: Slots = [20, null, null]
    const result = runSimulation(
      [tlEntry(20, "Heal Skill::_")],
      slots,
      emptyLoadouts,
    )
    const sustain = result.find((e) => e.kind === "sustain") as SustainEvent
    expect(sustain.targets).toEqual([20])
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
      [tlEntry(20, "Heal Skill::_")],
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

// ── Trailing-window collision (ADR-0018 / issue #177) ───────────────────────

const trailingHit = (actionFrame: number): DamageEntry => ({
  type: "Basic Attack",
  dmgType: "Damage",
  scalingStat: "ATK",
  actionFrame,
  value: 1.0,
  energy: 0,
  concerto: 0,
  toughness: 0,
  weakness: 0,
})

const charTrailingBase: EnrichedCharacter = {
  id: 30,
  name: "Trailing Char",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 200,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage",
          value: "100%",
          actionTime: 50,
          damage: [trailingHit(3), trailingHit(15), trailingHit(30)],
        },
      ],
      damage: [],
    },
    {
      id: 201,
      name: "Resonance Skill",
      type: "Resonance Skill",
      stages: [{ name: "Stage", value: "100%", actionTime: 40, damage: [] }],
      damage: [],
    },
    {
      id: 202,
      name: "Movement",
      type: "Movement",
      stages: [{ name: "Stage", value: "0", actionTime: 5, damage: [] }],
      damage: [],
    },
  ],
}

const charOtherTrailing: EnrichedCharacter = {
  id: 31,
  name: "Other Char",
  element: "Glacio",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 210,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [{ name: "Stage", value: "100%", actionTime: 10, damage: [] }],
      damage: [],
    },
  ],
}

describe("runSimulation — trailing-window collision (ADR-0018)", () => {
  it("no collision: trailing hit has landed before same-char cancel-capable re-entry", () => {
    const charSingleTrail: EnrichedCharacter = {
      ...charTrailingBase,
      id: 32,
      skills: [
        {
          id: 220,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              value: "100%",
              actionTime: 50,
              damage: [trailingHit(3), trailingHit(5)],
            },
          ],
          damage: [],
        },
        charTrailingBase.skills[1],
      ],
    }
    testCharacters = [charSingleTrail, charOtherTrailing]
    const entries: TimelineEntry[] = [
      {
        id: "t1",
        characterId: 32,
        stageId: "Normal Attack::_",
        variantKind: "swap",
      },
      { id: "t2", characterId: 31, stageId: "Normal Attack::_" },
      // frame after t1=6, after t2(advance=10)=16; trailing hitFrame=5 < 16 → no collision
      { id: "t3", characterId: 32, stageId: "Resonance Skill::_" },
    ]
    const result = runSimulation(entries, [32, 31, null], emptyLoadouts, 6, 6)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(2) // immediate(3) + trailing(5) — both land
    const actions = result.filter((e) => e.kind === "action")
    const rsAction = actions.find(
      (a) => a.characterId === 32 && a.skillType === "Resonance Skill",
    )
    expect(rsAction?.frame).toBe(16) // no pad
  })

  it("cancel-capable re-entry: drops trailing hits at or after new-entry start frame", () => {
    testCharacters = [charTrailingBase]
    const entries: TimelineEntry[] = [
      {
        id: "t1",
        characterId: 30,
        stageId: "Normal Attack::_",
        variantKind: "swap",
      },
      // Resonance Skill starts at frame 6; trailing hits at 15 and 30 >= 6 → dropped
      { id: "t2", characterId: 30, stageId: "Resonance Skill::_" },
    ]
    const result = runSimulation(entries, [30, null, null], emptyLoadouts, 6, 6)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(1) // only immediate hit at frame 3 survives
    expect(hits[0].frame).toBe(3)
  })

  it("non-cancel-capable re-entry: pads frame to last trailing hit; all trailing hits land", () => {
    testCharacters = [charTrailingBase, charOtherTrailing]
    const entries: TimelineEntry[] = [
      // Char 30 swap: advance=6, trailing hits at hitFrames 15 and 30
      {
        id: "t1",
        characterId: 30,
        stageId: "Normal Attack::_",
        variantKind: "swap",
      },
      // Char 31: advance=10, frame → 6+10=16
      { id: "t2", characterId: 31, stageId: "Normal Attack::_" },
      // Char 30 full (non-cancel-capable): would start at 16, but trailing hit 30 >= 16 → pad to 30
      { id: "t3", characterId: 30, stageId: "Normal Attack::_" },
    ]
    const result = runSimulation(entries, [30, 31, null], emptyLoadouts, 6, 6)
    const actions = result.filter((e) => e.kind === "action")
    // t3 action should be at frame 30 (padded from 16)
    const t3Action = actions.find((a) => a.characterId === 30 && !a.variantKind)
    expect(t3Action?.frame).toBe(30)
    // All trailing hits from t1 appear in log
    const hits = result.filter((e) => e.kind === "hit" && e.characterId === 30)
    const hitFrames = (hits as HitEvent[])
      .map((h) => h.frame)
      .sort((a, b) => a - b)
    expect(hitFrames).toContain(15)
    expect(hitFrames).toContain(30)
  })

  it("swap with all-zero actionFrame damage: no trailing hits, no collision drop", () => {
    const charZero: EnrichedCharacter = {
      ...charTrailingBase,
      id: 33,
      skills: [
        {
          id: 230,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              value: "100%",
              actionTime: 50,
              damage: [{ ...trailingHit(0) }, { ...trailingHit(0) }],
            },
          ],
          damage: [],
        },
        charTrailingBase.skills[1],
      ],
    }
    testCharacters = [charZero]
    const entries: TimelineEntry[] = [
      {
        id: "t1",
        characterId: 33,
        stageId: "Normal Attack::_",
        variantKind: "swap",
      },
      { id: "t2", characterId: 33, stageId: "Resonance Skill::_" },
    ]
    const result = runSimulation(entries, [33, null, null], emptyLoadouts, 6, 6)
    const hits = result.filter((e) => e.kind === "hit")
    // actionFrame=0 ≤ 6 → both immediate; Resonance Skill fires without collision logic
    expect(hits).toHaveLength(2)
  })

  it("Movement (non-cancel-capable) after swap: pads frame to last trailing hit", () => {
    testCharacters = [charTrailingBase]
    const entries: TimelineEntry[] = [
      {
        id: "t1",
        characterId: 30,
        stageId: "Normal Attack::_",
        variantKind: "swap",
      },
      // Movement starts at frame 6; trailing 30 >= 6 → collision → pad to 30
      { id: "t2", characterId: 30, stageId: "Movement::_" },
    ]
    const result = runSimulation(entries, [30, null, null], emptyLoadouts, 6, 6)
    const hits = result.filter((e) => e.kind === "hit")
    // immediate(3) + trailing(15) + trailing(30) = 3 hits; Movement has no damage
    expect(hits).toHaveLength(3)
    // Movement action event at frame 30 (padded from 6)
    const actions = result.filter((e) => e.kind === "action")
    const movAction = actions.find(
      (a) => a.characterId === 30 && a.skillType === "Movement",
    )
    expect(movAction?.frame).toBe(30)
  })
})

describe("runSimulation — delayBreakdown on ActionEvent", () => {
  it("react-only: cancel variant sets react=reactionDelay, pad=0", () => {
    testCharacters = [charVariant]
    const entry: TimelineEntry = {
      id: "db1",
      characterId: 10,
      stageId: "Normal Attack::_",
      variantKind: "cancel",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 6, 6)
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.delayBreakdown).toEqual({ react: 6, pad: 0 })
  })

  it("no-delay: full stage has no delayBreakdown", () => {
    testCharacters = [charVariant]
    const entry = tlEntry(10, "Normal Attack::_")
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 6, 6)
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.delayBreakdown).toBeUndefined()
  })

  it("pad-only: non-cancel-capable re-entry after swap sets pad>0, react=0", () => {
    testCharacters = [charTrailingBase, charOtherTrailing]
    const entries: TimelineEntry[] = [
      {
        id: "db2",
        characterId: 30,
        stageId: "Normal Attack::_",
        variantKind: "swap",
      },
      { id: "db3", characterId: 31, stageId: "Normal Attack::_" },
      // Char 30 Basic Attack starts at frame 16, trailing hit at 30 → padded to 30
      { id: "db4", characterId: 30, stageId: "Normal Attack::_" },
    ]
    const result = runSimulation(entries, [30, 31, null], emptyLoadouts, 6, 6)
    const padActions = result.filter(
      (e): e is ActionEvent => e.kind === "action",
    )
    const padAction = padActions.find(
      (a) => a.characterId === 30 && !a.variantKind,
    )
    // pad = 30 - 16 = 14
    expect(padAction?.delayBreakdown?.pad).toBe(14)
    expect(padAction?.delayBreakdown?.react).toBe(0)
  })

  it("swap with authored actionTime: react=reactionDelay, pad=0 (no collision)", () => {
    const charWithSwap: EnrichedCharacter = {
      ...charVariant,
      id: 13,
      skills: [
        {
          id: 8,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              value: "100%",
              actionTime: 50,
              variants: { swap: { actionTime: 10 } },
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charWithSwap]
    const entry: TimelineEntry = {
      id: "db5",
      characterId: 13,
      stageId: "Normal Attack::_",
      variantKind: "swap",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 6, 6)
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.delayBreakdown).toEqual({ react: 6, pad: 0 })
  })
})

describe("runSimulation — sourceEntryId (#186)", () => {
  it("authored hits carry sourceEntryId of their timeline entry", () => {
    testCharacters = [charA]
    const e1 = tlEntry(1, "Normal Attack::_", "entry-1")
    const e2 = tlEntry(1, "Normal Attack::_", "entry-2")
    const result = runSimulation([e1, e2], emptySlots, emptyLoadouts)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(2)
    expect(hits[0].sourceEntryId).toBe("entry-1")
    expect(hits[1].sourceEntryId).toBe("entry-2")
  })

  it("trailing-window hits carry sourceEntryId of the originating swap entry", () => {
    testCharacters = [charTrailingBase]
    const entries: TimelineEntry[] = [
      {
        id: "swap-entry",
        characterId: 30,
        stageId: "Normal Attack::_",
        variantKind: "swap",
      },
    ]
    const result = runSimulation(entries, [30, null, null], emptyLoadouts, 6, 6)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits.length).toBeGreaterThan(0)
    for (const hit of hits) {
      expect(hit.sourceEntryId).toBe("swap-entry")
    }
  })

  it("emitHit synthetic hits carry sourceEntryId of the triggering entry", () => {
    const coord: BuffDef = {
      id: "char.coord2",
      name: "Coord2",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: dmgHit(0.5),
          icdFrames: 0,
          skillType: "Basic Attack",
        },
      ],
    }
    const charWithCoord: EnrichedCharacter = { ...charA, buffs: [coord] }
    testCharacters = [charWithCoord]
    const entry = tlEntry(1, "Normal Attack::_", "trigger-entry")
    const result = runSimulation([entry], [1, null, null], emptyLoadouts)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(2)
    for (const hit of hits) {
      expect(hit.sourceEntryId).toBe("trigger-entry")
    }
  })
})
