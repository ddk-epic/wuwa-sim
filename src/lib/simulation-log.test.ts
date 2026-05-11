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
  {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
  },
  {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
  },
  {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
  },
]

function tlEntry(
  characterId: number,
  stageId: string,
  id = `${characterId}-${stageId}`,
): TimelineEntry {
  return { id, characterId, stageId }
}

describe("generateSimulationLog — empty", () => {
  it("returns empty array for empty timeline", () => {
    expect(generateSimulationLog([], emptySlots, emptyLoadouts)).toEqual([])
  })
})

describe("generateSimulationLog — single hit", () => {
  it("produces one action event and one hit event per timeline entry", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack::_")
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
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({ kind: "hit", damage: 2 })
  })
})

describe("generateSimulationLog — multi-hit stage", () => {
  it("emits one action event then one hit event per DamageEntry with [hit N] suffix", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack::(Stage 2)")
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
    const entry = tlEntry(1, "Normal Attack::(Stage 2)")
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
      tlEntry(1, "Normal Attack::_"),
      tlEntry(2, "Normal Attack::_"),
      tlEntry(1, "Normal Attack::_", "1-na-2"),
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
      tlEntry(1, "Normal Attack::_"),
      tlEntry(2, "Normal Attack::_"),
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
      {
        weaponId: null,
        weaponRank: 1,
        echoId: 10,
        echoSetSlot1Id: null,
        echoSetSlot2Id: null,
        sequence: 0,
      },
      {
        weaponId: null,
        weaponRank: 1,
        echoId: null,
        echoSetSlot1Id: null,
        echoSetSlot2Id: null,
        sequence: 0,
      },
      {
        weaponId: null,
        weaponRank: 1,
        echoId: null,
        echoSetSlot1Id: null,
        echoSetSlot2Id: null,
        sequence: 0,
      },
    ]
    const entry = tlEntry(1, "Echo One::Hit")
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
    const entry = tlEntry(99, "Normal Attack::_")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
    expect(result).toEqual([])
  })
})

describe("generateSimulationLog — unmatched stage", () => {
  it("skips timeline entries whose stage cannot be found", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack::Nonexistent")
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
      stageId: "Normal Attack::_",
    }
    const entry2: TimelineEntry = {
      id: "e2",
      characterId: 1,
      stageId: "Normal Attack::_",
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
      stageId: "Heavy Attack::_",
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
  it("populates statsSnapshot and empty activeBuffs on every HitEvent", () => {
    testCharacters = [charA]
    const entry = tlEntry(1, "Normal Attack::(Stage 2)")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
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
      tlEntry(1, "Intro::_"),
      tlEntry(1, "Resonance::_"),
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
    expect(resHit?.activeBuffs.some((b) => b.id === "char.intro.buff")).toBe(
      true,
    )
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
    const entry = tlEntry(1, "Normal Attack::_")
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
    const entry = tlEntry(1, "Normal Attack::_")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts)
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

describe("generateSimulationLog — stage variants (ADR 0008)", () => {
  it("full stage (no variantKind): damage entry lands", () => {
    testCharacters = [charVariant]
    const entry = tlEntry(10, "Normal Attack::_")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts, 9)
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
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts, 9)
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
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts, 9)
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
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts, 9)
    const action = result.find((e) => e.kind === "action")
    expect(action?.variantKind).toBe("cancel")
  })

  it("ActionEvent has no variantKind for full stage", () => {
    testCharacters = [charVariant]
    const entry = tlEntry(10, "Normal Attack::_")
    const result = generateSimulationLog([entry], emptySlots, emptyLoadouts, 9)
    const action = result.find((e) => e.kind === "action")
    expect(action?.variantKind).toBeUndefined()
  })
})

describe("generateSimulationLog — replacesSkillType (#87)", () => {
  const liberationHit = (type: string) => ({
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
            replacesSkillType: "Normal Attack",
            actionTime: 30,
            damage: [liberationHit("Basic Attack")],
          },
          {
            name: "Rampage Stage",
            newName: "Rampage Stage",
            value: "100%",
            replacesSkillType: "Resonance Skill",
            actionTime: 30,
            damage: [liberationHit("Resonance Skill")],
          },
        ],
        damage: [],
      },
    ],
  }

  it("resolveStage uses replacesSkillType for the action event skillType", () => {
    testCharacters = [charWithLiberation]
    const result = generateSimulationLog(
      [tlEntry(50, "Liberation::Frolicking Stage")],
      emptySlots,
      emptyLoadouts,
    )
    const action = result.find((e) => e.kind === "action")
    expect(action?.skillType).toBe("Normal Attack")
  })

  it("skillCast trigger with replacesSkillType fires on correct skill type", () => {
    const buff = {
      id: "test.cheer-dance",
      name: "Cheer Dance",
      trigger: {
        event: "skillCast" as const,
        characterId: 50,
        skillType: "Resonance Skill",
      },
      target: { kind: "self" as const },
      duration: { kind: "seconds" as const, v: 10 },
      effects: [
        {
          kind: "stat" as const,
          path: { stat: "elementBonus" as const, key: "Fusion" },
          value: { kind: "const" as const, v: 0.1 },
        },
      ],
    }
    const charWithBuff: EnrichedCharacter = {
      ...charWithLiberation,
      buffs: [buff],
    }
    testCharacters = [charWithBuff]
    const result = generateSimulationLog(
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
      (e) => e.kind === "hit" && e.skillType === "Normal Attack",
    ) as HitEvent | undefined
    expect(
      frolickingHit?.statsSnapshot.elementBonus?.["Fusion"],
    ).toBeUndefined()
    const rampageHit = result.find(
      (e) => e.kind === "hit" && e.skillType === "Resonance Skill",
    ) as HitEvent | undefined
    expect(rampageHit?.statsSnapshot.elementBonus?.["Fusion"]).toBeCloseTo(0.1)
  })

  it("hitLanded trigger uses per-hit type — Basic Attack trigger fires on Basic Attack hits only", () => {
    const s1 = {
      id: "test.s1",
      name: "S1",
      trigger: {
        event: "hitLanded" as const,
        actor: "self" as const,
        skillType: "Basic Attack",
      },
      target: { kind: "self" as const },
      duration: { kind: "seconds" as const, v: 6 },
      stacking: { max: 4, onRetrigger: "addStack" as const },
      effects: [
        {
          kind: "stat" as const,
          path: { stat: "elementBonus" as const, key: "Fusion" },
          value: { kind: "perStack" as const, v: 0.03 },
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
              damage: [liberationHit("Basic Attack")],
            },
            {
              name: "Heavy Attack",
              newName: "Heavy Attack",
              value: "200%",
              actionTime: 30,
              damage: [liberationHit("Heavy Attack")],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charWithHeavy]

    // After a Basic Attack hit, S1 is applied. The NEXT hit sees S1 active.
    const basicThenBasicResult = generateSimulationLog(
      [tlEntry(51, "Normal Attack::_"), tlEntry(51, "Normal Attack::_", "2")],
      [51, null, null],
      emptyLoadouts,
    )
    const secondBasicHit = basicThenBasicResult
      .filter((e) => e.kind === "hit")
      .at(1) as HitEvent | undefined
    expect(secondBasicHit?.activeBuffs.some((b) => b.id === "test.s1")).toBe(
      true,
    )

    // Heavy Attack hits do NOT trigger S1 — the buff remains absent.
    const heavyResult = generateSimulationLog(
      [tlEntry(51, "Normal Attack::Heavy Attack")],
      [51, null, null],
      emptyLoadouts,
    )
    const heavyHit = heavyResult.find((e) => e.kind === "hit") as
      | HitEvent
      | undefined
    expect(heavyHit?.activeBuffs.some((b) => b.id === "test.s1")).toBe(false)
  })
})

describe("generateSimulationLog — stageId trigger filter (#89)", () => {
  const hit = () => ({
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
    const buff = {
      id: "test.stage-alpha-only",
      name: "Alpha Only",
      trigger: {
        event: "skillCast" as const,
        characterId: 60,
        stageId: "Skill A::Stage Alpha",
      },
      target: { kind: "self" as const },
      duration: { kind: "seconds" as const, v: 10 },
      effects: [
        {
          kind: "stat" as const,
          path: { stat: "elementBonus" as const, key: "Fusion" },
          value: { kind: "const" as const, v: 0.15 },
        },
      ],
    }
    testCharacters = [{ ...charWithTwoStages, buffs: [buff] }]

    const alphaResult = generateSimulationLog(
      [tlEntry(60, "Skill A::Stage Alpha")],
      [60, null, null],
      emptyLoadouts,
    )
    const alphaHit = alphaResult.find((e) => e.kind === "hit") as
      | HitEvent
      | undefined
    expect(
      alphaHit?.activeBuffs.some((b) => b.id === "test.stage-alpha-only"),
    ).toBe(true)

    const betaResult = generateSimulationLog(
      [tlEntry(60, "Skill A::Stage Beta")],
      [60, null, null],
      emptyLoadouts,
    )
    const betaHit = betaResult.find((e) => e.kind === "hit") as
      | HitEvent
      | undefined
    expect(
      betaHit?.activeBuffs.some((b) => b.id === "test.stage-alpha-only"),
    ).toBe(false)
  })

  it("array stageId — buff fires on any of the listed stages", () => {
    const buff = {
      id: "test.both-stages",
      name: "Both Stages",
      trigger: {
        event: "skillCast" as const,
        characterId: 60,
        stageId: ["Skill A::Stage Alpha", "Skill A::Stage Beta"],
      },
      target: { kind: "self" as const },
      duration: { kind: "seconds" as const, v: 10 },
      effects: [
        {
          kind: "stat" as const,
          path: { stat: "elementBonus" as const, key: "Fusion" },
          value: { kind: "const" as const, v: 0.1 },
        },
      ],
    }
    testCharacters = [{ ...charWithTwoStages, buffs: [buff] }]

    for (const stageId of ["Skill A::Stage Alpha", "Skill A::Stage Beta"]) {
      const result = generateSimulationLog(
        [tlEntry(60, stageId)],
        [60, null, null],
        emptyLoadouts,
      )
      const h = result.find((e) => e.kind === "hit") as HitEvent | undefined
      expect(h?.activeBuffs.some((b) => b.id === "test.both-stages")).toBe(true)
    }
  })

  it("no stageId filter — buff fires on all stages as before", () => {
    const buff = {
      id: "test.any-stage",
      name: "Any Stage",
      trigger: { event: "skillCast" as const, characterId: 60 },
      target: { kind: "self" as const },
      duration: { kind: "seconds" as const, v: 10 },
      effects: [
        {
          kind: "stat" as const,
          path: { stat: "elementBonus" as const, key: "Fusion" },
          value: { kind: "const" as const, v: 0.1 },
        },
      ],
    }
    testCharacters = [{ ...charWithTwoStages, buffs: [buff] }]

    for (const stageId of ["Skill A::Stage Alpha", "Skill A::Stage Beta"]) {
      const result = generateSimulationLog(
        [tlEntry(60, stageId)],
        [60, null, null],
        emptyLoadouts,
      )
      const h = result.find((e) => e.kind === "hit") as HitEvent | undefined
      expect(h?.activeBuffs.some((b) => b.id === "test.any-stage")).toBe(true)
    }
  })
})

describe("generateSimulationLog — Energy Recharge (#98)", () => {
  const erBuff = (id: number, erPct: number) => ({
    id: `char${id}.er`,
    name: "ER Buff",
    trigger: { event: "simStart" as const },
    target: { kind: "self" as const },
    duration: { kind: "permanent" as const },
    effects: [
      {
        kind: "stat" as const,
        path: { stat: "energyRechargePct" as const },
        value: { kind: "const" as const, v: erPct },
      },
    ],
  })

  it("authored hit energy scaled by (1 + actor.energyRechargePct)", () => {
    // charA has base energy=5 per hit; with 50% ER should credit 7.5
    const charWithER: EnrichedCharacter = { ...charA, buffs: [erBuff(1, 0.5)] }
    testCharacters = [charWithER]
    const result = generateSimulationLog(
      [tlEntry(1, "Normal Attack::_")],
      [1, null, null],
      emptyLoadouts,
    )
    const hit = result.find((e) => e.kind === "hit") as HitEvent | undefined
    expect(hit?.cumulativeEnergy).toBeCloseTo(5 * 1.5)
  })

  it("default ER=0 gives no scaling (backwards compatible)", () => {
    testCharacters = [charA]
    const result = generateSimulationLog(
      [tlEntry(1, "Normal Attack::_")],
      [1, null, null],
      emptyLoadouts,
    )
    const hit = result.find((e) => e.kind === "hit") as HitEvent | undefined
    expect(hit?.cumulativeEnergy).toBe(5)
  })

  it("synthetic hit uses buff-owner ER, not on-field character ER", () => {
    // Char 1: on-field, no ER
    // Char 2: off-field, 50% ER; has an emitHit buff that fires on char1 hits
    //         with energy=10. Char 2 should credit 15, not 10.
    const coordBuff = {
      id: "char2.coord",
      name: "Coord",
      trigger: {
        event: "hitLanded" as const,
        characterId: 1,
        actor: "any" as const,
      },
      target: { kind: "self" as const },
      duration: { kind: "permanent" as const },
      effects: [
        {
          kind: "emitHit" as const,
          damage: { ...dmgHit(0.5, 10), dmgType: "Fusion" },
          icdFrames: 0,
          skillType: "Coordinated Attack",
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
    const result = generateSimulationLog(
      [tlEntry(1, "Normal Attack::_")],
      [1, 2, null],
      emptyLoadouts,
    )
    const synth = result.find((e) => e.kind === "hit" && e.synthetic) as
      | HitEvent
      | undefined
    expect(synth).toBeDefined()
    // Char 2 credited energy: 10 * 1.5 = 15 (buff owner ER, not on-field char ER)
    expect(synth?.cumulativeEnergy).toBeCloseTo(10 * 1.5)
  })
})
