import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedSkillAttribute } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"
import { findStageByEntry, makeStageId, resolveStageExecution } from "./stage"

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

const baseChar = (
  overrides: Partial<EnrichedCharacter> = {},
): EnrichedCharacter => ({
  id: 1,
  name: "TestChar",
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
        { name: "Stage 1", value: "1", actionTime: 30, damage: [] },
        {
          name: "Named",
          value: "1",
          actionTime: 20,
          damage: [],
          newName: "3rd",
        },
      ],
      damage: [],
    },
  ],
  ...overrides,
})

const baseEcho = (overrides: Partial<EnrichedEcho> = {}): EnrichedEcho => ({
  id: 10,
  name: "EchoSkill",
  cost: 3,
  element: "Glacio",
  set: "TestSet",
  buffs: [],
  skill: {
    cooldown: 20,
    description: "",
    stages: [
      { name: "Echo Stage", newName: "active", actionTime: 60, damage: [] },
    ],
  },
  ...overrides,
})

const emptyLoadout: SlotLoadout = {
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
  echoBuild: "4-3-3-1-1",
  cost4Mains: ["cd"],
  cost3Mains: ["elemDmg", "elemDmg"],
}

const slots: Slots = [1, null, null]

function makeStage(
  actionTime: number,
  variants?: EnrichedSkillAttribute["variants"],
  damage: EnrichedSkillAttribute["damage"] = [],
): EnrichedSkillAttribute {
  return { name: "Stage", value: "100%", actionTime, damage, variants }
}

describe("makeStageId", () => {
  it("returns baseName::_ when newName is undefined", () => {
    expect(makeStageId("Normal Attack")).toBe("Normal Attack::_")
  })

  it("returns baseName::newName when newName is provided", () => {
    expect(makeStageId("Normal Attack", "3rd")).toBe("Normal Attack::3rd")
  })
})

describe("findStageByEntry — character skill", () => {
  it("resolves a stage with no newName (uses _ sentinel)", () => {
    testCharacters = [baseChar()]
    const entry = { id: "e1", characterId: 1, stageId: "Normal Attack::_" }
    const result = findStageByEntry(entry, slots, [
      emptyLoadout,
      emptyLoadout,
      emptyLoadout,
    ])
    expect(result).not.toBeNull()
    expect(result?.stageName).toBe("Stage 1")
    expect(result?.skillType).toBe("Normal Attack")
  })

  it("resolves a stage with an explicit newName", () => {
    testCharacters = [baseChar()]
    const entry = { id: "e2", characterId: 1, stageId: "Normal Attack::3rd" }
    const result = findStageByEntry(entry, slots, [
      emptyLoadout,
      emptyLoadout,
      emptyLoadout,
    ])
    expect(result).not.toBeNull()
    expect(result?.stageName).toBe("Named")
  })

  it("returns null when stageId does not match any stage", () => {
    testCharacters = [baseChar()]
    const entry = {
      id: "e3",
      characterId: 1,
      stageId: "Normal Attack::missing",
    }
    const result = findStageByEntry(entry, slots, [
      emptyLoadout,
      emptyLoadout,
      emptyLoadout,
    ])
    expect(result).toBeNull()
  })

  it("returns null when characterId is not in catalog", () => {
    testCharacters = []
    const entry = { id: "e4", characterId: 99, stageId: "Normal Attack::_" }
    const result = findStageByEntry(entry, slots, [
      emptyLoadout,
      emptyLoadout,
      emptyLoadout,
    ])
    expect(result).toBeNull()
  })

  it("includes requiresStageId when set on the stage", () => {
    testCharacters = [
      baseChar({
        skills: [
          {
            id: 1,
            name: "Normal Attack",
            type: "Normal Attack",
            stages: [
              {
                name: "S2",
                value: "1",
                actionTime: 30,
                damage: [],
                newName: "2nd",
                requiresStageId: "Normal Attack::_",
              },
            ],
            damage: [],
          },
        ],
      }),
    ]
    const entry = { id: "e5", characterId: 1, stageId: "Normal Attack::2nd" }
    const result = findStageByEntry(entry, slots, [
      emptyLoadout,
      emptyLoadout,
      emptyLoadout,
    ])
    expect(result?.requiresStageId).toBe("Normal Attack::_")
  })
})

describe("findStageByEntry — echo skill", () => {
  it("resolves an echo stage when character is in the slot with that echo", () => {
    testCharacters = [baseChar()]
    testEchoes = [baseEcho()]
    const loadouts: SlotLoadout[] = [
      { ...emptyLoadout, echoId: 10 },
      emptyLoadout,
      emptyLoadout,
    ]
    const entry = { id: "e6", characterId: 1, stageId: "EchoSkill::active" }
    const result = findStageByEntry(entry, slots, loadouts)
    expect(result).not.toBeNull()
    expect(result?.skillType).toBe("Echo Skill")
    expect(result?.element).toBe("Glacio")
  })

  it("returns null when no echo is equipped", () => {
    testCharacters = [baseChar()]
    const entry = { id: "e7", characterId: 1, stageId: "EchoSkill::active" }
    const result = findStageByEntry(entry, slots, [
      emptyLoadout,
      emptyLoadout,
      emptyLoadout,
    ])
    expect(result).toBeNull()
  })
})

describe("resolveStageExecution — full stage (no variant)", () => {
  it("returns stage.actionTime as duration when variantKind is undefined", () => {
    expect(resolveStageExecution(makeStage(50), undefined, 9).duration).toBe(50)
  })

  it("falls back to stage.actionTime when variantKind not on stage", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "instantCancel", 9).duration).toBe(50)
  })

  it("falls back to stage.actionTime when stage has no variants", () => {
    expect(
      resolveStageExecution(makeStage(50, undefined), "cancel", 9).duration,
    ).toBe(50)
  })
})

describe("resolveStageExecution — cancel variant", () => {
  it("returns variant.actionTime + reactionDelay as duration", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "cancel", 9).duration).toBe(42)
  })

  it("varies with reactionDelay", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "cancel", 0).duration).toBe(33)
    expect(resolveStageExecution(stage, "cancel", 5).duration).toBe(38)
  })
})

describe("resolveStageExecution — instantCancel variant", () => {
  it("returns variant.actionTime + reactionDelay as duration", () => {
    const stage = makeStage(50, {
      cancel: { actionTime: 33 },
      instantCancel: { actionTime: 7 },
    })
    expect(resolveStageExecution(stage, "instantCancel", 9).duration).toBe(16)
  })
})

describe("resolveStageExecution — damage filtering", () => {
  it("returns all damage when no variant", () => {
    const damage = [
      {
        type: "Basic Attack",
        dmgType: "Damage",
        scalingStat: "ATK",
        actionFrame: 10,
        value: 100,
        energy: 0,
        concerto: 0,
        toughness: 0,
        weakness: 0,
      },
      {
        type: "Basic Attack",
        dmgType: "Damage",
        scalingStat: "ATK",
        actionFrame: 30,
        value: 200,
        energy: 0,
        concerto: 0,
        toughness: 0,
        weakness: 0,
      },
    ]
    const stage = makeStage(50, undefined, damage)
    expect(resolveStageExecution(stage, undefined, 9).damage).toHaveLength(2)
  })

  it("filters hits beyond variant cutoff", () => {
    const damage = [
      {
        type: "Basic Attack",
        dmgType: "Damage",
        scalingStat: "ATK",
        actionFrame: 10,
        value: 100,
        energy: 0,
        concerto: 0,
        toughness: 0,
        weakness: 0,
      },
      {
        type: "Basic Attack",
        dmgType: "Damage",
        scalingStat: "ATK",
        actionFrame: 50,
        value: 200,
        energy: 0,
        concerto: 0,
        toughness: 0,
        weakness: 0,
      },
    ]
    const stage = makeStage(60, { cancel: { actionTime: 33 } }, damage)
    const { damage: filtered } = resolveStageExecution(stage, "cancel", 9)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].actionFrame).toBe(10)
  })
})
