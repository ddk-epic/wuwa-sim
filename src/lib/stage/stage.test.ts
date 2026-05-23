import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  DamageEntry,
  EnrichedCharacter,
  EnrichedSkillAttribute,
} from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"
import {
  findStageByEntry,
  makeStageId,
  resolveStageExecution,
  STAGE_CAST_NAME,
} from "./stage"

let testCharacters: EnrichedCharacter[] = []
let testEchoes: EnrichedEcho[] = []

vi.mock("../loadout/catalog", () => ({
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
  sets: ["TestSet"],
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
    expect(result?.skillType).toBe("Basic Attack")
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

describe(`findStageByEntry — STAGE_CAST_NAME ("${STAGE_CAST_NAME}") concerto inheritance`, () => {
  function makeSkillChar(
    skillConcerto: number | undefined,
    stageConcerto: number | undefined,
    stageName: string,
    newName: string = "",
  ): EnrichedCharacter {
    return baseChar({
      skills: [
        {
          id: 2,
          name: "Resonance Skill",
          type: "Resonance Skill",
          concerto: skillConcerto,
          stages: [
            {
              name: stageName,
              newName,
              value: "",
              actionTime: 0,
              concerto: stageConcerto,
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    })
  }

  it("'Skill DMG' stage with parent Skill.concerto=N yields ResolvedStage.concerto=N", () => {
    testCharacters = [makeSkillChar(30, undefined, STAGE_CAST_NAME)]
    const result = findStageByEntry(
      { id: "e1", characterId: 1, stageId: "Resonance Skill::" },
      slots,
      [emptyLoadout, emptyLoadout, emptyLoadout],
    )
    expect(result?.concerto).toBe(30)
  })

  it("non-'Skill DMG' stage ignores parent Skill.concerto", () => {
    testCharacters = [makeSkillChar(30, undefined, "Stage 2", "2nd")]
    const result = findStageByEntry(
      { id: "e2", characterId: 1, stageId: "Resonance Skill::2nd" },
      slots,
      [emptyLoadout, emptyLoadout, emptyLoadout],
    )
    expect(result?.concerto).toBe(0)
  })

  it("'Skill DMG' stage own concerto sums with parent Skill.concerto", () => {
    testCharacters = [makeSkillChar(30, 5, STAGE_CAST_NAME)]
    const result = findStageByEntry(
      { id: "e3", characterId: 1, stageId: "Resonance Skill::" },
      slots,
      [emptyLoadout, emptyLoadout, emptyLoadout],
    )
    expect(result?.concerto).toBe(35)
  })

  it("'Skill DMG' stage skillName equals bare skill.name regardless of newName", () => {
    testCharacters = [makeSkillChar(10, undefined, STAGE_CAST_NAME, "Custom")]
    const result = findStageByEntry(
      {
        id: "e4",
        characterId: 1,
        stageId: "Resonance Skill::Custom",
      },
      slots,
      [emptyLoadout, emptyLoadout, emptyLoadout],
    )
    expect(result?.skillName).toBe("Resonance Skill")
  })
})

describe("resolveStageExecution — full stage (no variant)", () => {
  it("returns stage.actionTime as advance when variantKind is undefined", () => {
    expect(resolveStageExecution(makeStage(50), undefined, 9).advance).toBe(50)
  })

  it("falls back to stage.actionTime when variantKind not on stage", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "instantCancel", 9).advance).toBe(50)
  })

  it("falls back to stage.actionTime when stage has no variants", () => {
    expect(
      resolveStageExecution(makeStage(50, undefined), "cancel", 9).advance,
    ).toBe(50)
  })
})

describe("resolveStageExecution — cancel variant", () => {
  it("returns variant.actionTime + reactionDelay as advance", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "cancel", 9).advance).toBe(42)
  })

  it("varies with reactionDelay", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "cancel", 0).advance).toBe(33)
    expect(resolveStageExecution(stage, "cancel", 5).advance).toBe(38)
  })
})

describe("resolveStageExecution — instantCancel variant", () => {
  it("returns variant.actionTime + reactionDelay as advance", () => {
    const stage = makeStage(50, {
      cancel: { actionTime: 33 },
      instantCancel: { actionTime: 7 },
    })
    expect(resolveStageExecution(stage, "instantCancel", 9).advance).toBe(16)
  })
})

describe("resolveStageExecution — swap variant", () => {
  it("uses authored actionTime + reactionDelay when variants.swap is defined", () => {
    const stage = makeStage(50, { swap: { actionTime: 10 } })
    expect(resolveStageExecution(stage, "swap", 6, 6).advance).toBe(16)
  })

  it("falls back to swapFrames when no variants.swap authored", () => {
    const stage = makeStage(50, undefined)
    expect(resolveStageExecution(stage, "swap", 6, 6).advance).toBe(6)
  })

  it("returns all damage unfiltered even when actionFrame > advance", () => {
    const damage: DamageEntry[] = [
      {
        type: "Basic Attack",
        dmgType: "Damage",
        scalingStat: "ATK",
        actionFrame: 5,
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
        actionFrame: 40,
        value: 200,
        energy: 0,
        concerto: 0,
        toughness: 0,
        weakness: 0,
      },
    ]
    const stage = makeStage(50, { swap: { actionTime: 10 } }, damage)
    const { hits } = resolveStageExecution(stage, "swap", 6, 6)
    expect(hits).toHaveLength(2)
  })

  it("authored swap advance respects different swapFrames fallback values", () => {
    const stage = makeStage(50, undefined)
    expect(resolveStageExecution(stage, "swap", 6, 12).advance).toBe(12)
    expect(resolveStageExecution(stage, "swap", 6, 0).advance).toBe(0)
  })
})

describe("resolveStageExecution — damage filtering", () => {
  it("returns all damage when no variant", () => {
    const damage: DamageEntry[] = [
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
    expect(resolveStageExecution(stage, undefined, 9).hits).toHaveLength(2)
  })

  it("filters hits beyond variant cutoff", () => {
    const damage: DamageEntry[] = [
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
    const { hits: filtered } = resolveStageExecution(stage, "cancel", 9)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].actionFrame).toBe(10)
  })
})

describe("resolveStageExecution — independent flag (#217)", () => {
  const baseDamage = (
    actionFrame: number,
    independent?: boolean,
  ): DamageEntry => ({
    type: "Basic Attack",
    dmgType: "Damage",
    scalingStat: "ATK",
    actionFrame,
    value: 1,
    energy: 0,
    concerto: 0,
    toughness: 0,
    weakness: 0,
    ...(independent ? { independent } : {}),
  })

  it("flagged entry survives cancel past cutoff", () => {
    const damage = [baseDamage(10), baseDamage(90, true)]
    const stage = makeStage(107, { cancel: { actionTime: 54 } }, damage)
    const { hits } = resolveStageExecution(stage, "cancel", 9)
    expect(hits).toHaveLength(2)
    expect(hits.find((h) => h.actionFrame === 90)).toBeDefined()
  })

  it("flagged entry survives instantCancel past cutoff", () => {
    const damage = [baseDamage(10), baseDamage(90, true)]
    const stage = makeStage(107, { instantCancel: { actionTime: 20 } }, damage)
    const { hits } = resolveStageExecution(stage, "instantCancel", 9)
    expect(hits).toHaveLength(2)
    expect(hits.find((h) => h.actionFrame === 90)).toBeDefined()
  })

  it("unflagged entries beyond cutoff are still truncated", () => {
    const damage = [baseDamage(10), baseDamage(90), baseDamage(90, true)]
    const stage = makeStage(107, { cancel: { actionTime: 54 } }, damage)
    const { hits } = resolveStageExecution(stage, "cancel", 9)
    // frame-10 survives, frame-90 unflagged truncated, frame-90 flagged survives
    expect(hits).toHaveLength(2)
    expect(hits[0].actionFrame).toBe(10)
    expect(hits[1].independent).toBe(true)
  })

  it("flag is inert on full execution (no variant)", () => {
    const damage = [baseDamage(10), baseDamage(90, true)]
    const stage = makeStage(107, { cancel: { actionTime: 54 } }, damage)
    const { hits } = resolveStageExecution(stage, undefined, 9)
    expect(hits).toHaveLength(2)
  })
})

describe("resolveStageExecution — react value", () => {
  it("returns react=0 when no variant", () => {
    expect(resolveStageExecution(makeStage(50), undefined, 9).react).toBe(0)
  })

  it("returns react=reactionDelay for cancel with stage-authored variant", () => {
    const stage = makeStage(50, { cancel: { actionTime: 33 } })
    expect(resolveStageExecution(stage, "cancel", 9).react).toBe(9)
  })

  it("returns react=0 for cancel when stage does not author the variant", () => {
    const stage = makeStage(50, undefined)
    expect(resolveStageExecution(stage, "cancel", 9).react).toBe(0)
  })

  it("returns react=reactionDelay for swap with stage-authored variants.swap", () => {
    const stage = makeStage(50, { swap: { actionTime: 10 } })
    expect(resolveStageExecution(stage, "swap", 6, 6).react).toBe(6)
  })

  it("returns react=0 for swap falling back to swapFrames", () => {
    const stage = makeStage(50, undefined)
    expect(resolveStageExecution(stage, "swap", 6, 6).react).toBe(0)
  })
})

describe("resolveStageExecution — variantFloor", () => {
  it("floor wins: actionTime=0, react=6, floor=15 → advance=15, floor=15, react=0", () => {
    const stage = makeStage(50, { cancel: { actionTime: 0 } })
    const result = resolveStageExecution(stage, "cancel", 6, 6, 15)
    expect(result.advance).toBe(15)
    expect(result.floor).toBe(15)
    expect(result.react).toBe(0)
  })

  it("react wins: actionTime=30, react=6, floor=15 → advance=36, react=6, floor=0", () => {
    const stage = makeStage(50, { cancel: { actionTime: 30 } })
    const result = resolveStageExecution(stage, "cancel", 6, 6, 15)
    expect(result.advance).toBe(36)
    expect(result.react).toBe(6)
    expect(result.floor).toBe(0)
  })

  it("swap authored: floor wins when floor > actionTime + react", () => {
    const stage = makeStage(50, { swap: { actionTime: 0 } })
    const result = resolveStageExecution(stage, "swap", 6, 6, 15)
    expect(result.advance).toBe(15)
    expect(result.floor).toBe(15)
    expect(result.react).toBe(0)
  })

  it("swap unauthored fallback: floor does not apply to swapFrames path", () => {
    const stage = makeStage(50, undefined)
    const result = resolveStageExecution(stage, "swap", 6, 6, 15)
    expect(result.advance).toBe(6)
    expect(result.floor).toBe(0)
    expect(result.react).toBe(0)
  })

  it("variantFloor=0 disables flooring (react wins at tie or above)", () => {
    const stage = makeStage(50, { cancel: { actionTime: 0 } })
    const result = resolveStageExecution(stage, "cancel", 6, 6, 0)
    expect(result.advance).toBe(6)
    expect(result.react).toBe(6)
    expect(result.floor).toBe(0)
  })

  it("instantCancel with floor wins", () => {
    const stage = makeStage(50, { instantCancel: { actionTime: 0 } })
    const result = resolveStageExecution(stage, "instantCancel", 6, 6, 15)
    expect(result.advance).toBe(15)
    expect(result.floor).toBe(15)
    expect(result.react).toBe(0)
  })

  it("floor raises damage cutoff: hit at actionFrame=10 survives under floor=15", () => {
    const damage: DamageEntry[] = [
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
    ]
    // actionTime=0 + react=6 = 6 < 10, so without floor the hit would be dropped
    // with floor=15 the advance becomes 15, so 10 <= 15 passes
    const stage = makeStage(50, { cancel: { actionTime: 0 } }, damage)
    const withFloor = resolveStageExecution(stage, "cancel", 6, 6, 15)
    expect(withFloor.hits).toHaveLength(1)
    const withoutFloor = resolveStageExecution(stage, "cancel", 6, 6, 0)
    expect(withoutFloor.hits).toHaveLength(0)
  })
})
