import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  DamageEntry,
  EnrichedCharacter,
  SkillType,
} from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { BuffDef } from "#/types/buff"
import type { ActionEvent } from "#/types/simulation-log"
import {
  ECHO_BUILD_LAYOUT,
  ECHO_MAIN_3COST_VARIABLE,
} from "./loadout/echo-stat-constants"

import { runSimulation } from "./simulation"
import { tlEntry } from "./simulation.test-fixtures"

const BASE_ELEM_BONUS =
  ECHO_BUILD_LAYOUT["4-3-3-1-1"].cost3 * ECHO_MAIN_3COST_VARIABLE.elemDmg

let testCharacters: EnrichedCharacter[] = []
vi.mock("./loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getEchoById: () => null,
}))
afterEach(() => {
  testCharacters = []
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
          category: "Basic Attack",
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
    const entry = tlEntry(
      10,
      "char.variant-char.basic-attack.normal-attack._::basic-attack",
    )
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 9)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(1)
  })

  it("cancel variant: actionFrame 23 <= cutoff 42, damage lands", () => {
    testCharacters = [charVariant]
    const entry: TimelineEntry = {
      id: "v1",
      characterId: 10,
      stageId: "char.variant-char.basic-attack.normal-attack._::basic-attack",
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
      stageId: "char.variant-char.basic-attack.normal-attack._::basic-attack",
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
      stageId: "char.variant-char.basic-attack.normal-attack._::basic-attack",
      variantKind: "cancel",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 9)
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.variantKind).toBe("cancel")
  })

  it("ActionEvent has no variantKind for full stage", () => {
    testCharacters = [charVariant]
    const entry = tlEntry(
      10,
      "char.variant-char.basic-attack.normal-attack._::basic-attack",
    )
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
              category: "Basic Attack",
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
      stageId: "char.variant-char.basic-attack.normal-attack._::basic-attack",
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
              category: "Basic Attack",
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
      stageId: "char.variant-char.basic-attack.normal-attack._::basic-attack",
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
            category: "Resonance Liberation",
            newName: "Frolicking Stage",
            value: "100%",
            actionTime: 30,
            damage: [libHit("Basic Attack")],
          },
          {
            name: "Rampage Stage",
            category: "Resonance Liberation",
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

  it("skillType on action event reflects damage[0].type — Frolicking Stage reports Basic Attack", () => {
    testCharacters = [charWithLiberation]
    const result = runSimulation(
      [
        tlEntry(
          50,
          "char.liberation-char.resonance-liberation.liberation.frolicking-stage::basic-attack",
        ),
      ],
      emptySlots,
      emptyLoadouts,
    )
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.skillType).toBe("Basic Attack")
  })

  it("skillType on action event reflects damage[0].type — Rampage Stage reports Resonance Skill", () => {
    testCharacters = [charWithLiberation]
    const result = runSimulation(
      [
        tlEntry(
          50,
          "char.liberation-char.resonance-liberation.liberation.rampage-stage::resonance-skill",
        ),
      ],
      emptySlots,
      emptyLoadouts,
    )
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.skillType).toBe("Resonance Skill")
  })

  it("skillCast trigger fires on parent skill type (Resonance Liberation)", () => {
    const buff: BuffDef = {
      id: "test.cheer-dance",
      name: "Cheer Dance",
      trigger: {
        event: "skillCast",
        characterId: 50,
        skillCategory: "Resonance Liberation",
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
        tlEntry(
          50,
          "char.liberation-char.resonance-liberation.liberation.frolicking-stage::basic-attack",
        ),
        tlEntry(
          50,
          "char.liberation-char.resonance-liberation.liberation.rampage-stage::resonance-skill",
        ),
      ],
      [50, null, null],
      emptyLoadouts,
    )
    const buffApplied = result.find(
      (e) => e.kind === "buffApplied" && e.buffId === "test.cheer-dance",
    )
    expect(buffApplied).toBeDefined()
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits[0]?.statsSnapshot.elementBonus["Fusion"]).toBeCloseTo(
      0.1 + BASE_ELEM_BONUS,
    )
    expect(hits[1]?.statsSnapshot.elementBonus["Fusion"]).toBeCloseTo(
      0.1 + BASE_ELEM_BONUS,
    )
  })

  it("hitLanded trigger uses parent skill type — all stages under Normal Attack trigger Basic Attack buff", () => {
    const s1: BuffDef = {
      id: "test.s1",
      name: "S1",
      trigger: {
        event: "hitLanded",
        actor: "self",
        skillCategory: "Basic Attack",
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
              category: "Basic Attack",
              value: "100%",
              actionTime: 30,
              damage: [libHit("Basic Attack")],
            },
            {
              name: "Heavy Attack",
              category: "Basic Attack",
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
      [
        tlEntry(
          51,
          "char.heavy-char.basic-attack.normal-attack._::basic-attack",
        ),
        tlEntry(
          51,
          "char.heavy-char.basic-attack.normal-attack._::basic-attack",
          "2",
        ),
      ],
      [51, null, null],
      emptyLoadouts,
    )
    const secondBasicHit = basicThenBasicResult
      .filter((e) => e.kind === "hit")
      .at(1)
    expect(secondBasicHit?.activeBuffs.some((b) => b.id === "test.s1")).toBe(
      true,
    )

    // Heavy Attack stage also fires S1 because parent skill type is "Basic Attack"
    const heavyResult = runSimulation(
      [
        tlEntry(
          51,
          "char.heavy-char.basic-attack.normal-attack._::basic-attack",
        ),
        tlEntry(
          51,
          "char.heavy-char.basic-attack.normal-attack.heavy-attack::heavy-attack",
        ),
      ],
      [51, null, null],
      emptyLoadouts,
    )
    const heavyHit = heavyResult.filter((e) => e.kind === "hit").at(1)
    expect(heavyHit?.activeBuffs.some((b) => b.id === "test.s1")).toBe(true)
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
            category: "Resonance Liberation",
            newName: "Stage Alpha",
            value: "100%",
            actionTime: 20,
            damage: [hit()],
          },
          {
            name: "Stage Beta",
            category: "Resonance Liberation",
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
        stageId:
          "char.stage-char.resonance-liberation.skill-a.stage-alpha::basic-attack",
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
      [
        tlEntry(
          60,
          "char.stage-char.resonance-liberation.skill-a.stage-alpha::basic-attack",
        ),
      ],
      [60, null, null],
      emptyLoadouts,
    )
    const alphaHit = alphaResult.find((e) => e.kind === "hit")
    expect(
      alphaHit?.activeBuffs.some((b) => b.id === "test.stage-alpha-only"),
    ).toBe(true)

    const betaResult = runSimulation(
      [
        tlEntry(
          60,
          "char.stage-char.resonance-liberation.skill-a.stage-beta::basic-attack",
        ),
      ],
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
        stageId: [
          "char.stage-char.resonance-liberation.skill-a.stage-alpha::basic-attack",
          "char.stage-char.resonance-liberation.skill-a.stage-beta::basic-attack",
        ],
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

    for (const stageId of [
      "char.stage-char.resonance-liberation.skill-a.stage-alpha::basic-attack",
      "char.stage-char.resonance-liberation.skill-a.stage-beta::basic-attack",
    ]) {
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

    for (const stageId of [
      "char.stage-char.resonance-liberation.skill-a.stage-alpha::basic-attack",
      "char.stage-char.resonance-liberation.skill-a.stage-beta::basic-attack",
    ]) {
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
