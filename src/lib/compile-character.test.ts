// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"
import { ALL_CHARACTERS } from "#/data/characters"
import { ALL_ECHOES } from "#/data/echoes"
import { deriveKey, STAGE_CAST_NAME } from "./stage"
import {
  buildStageLabels,
  compileCharacter,
  compileEcho,
  findStageByEntry,
} from "./compile-character"

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

const baseChar = (
  overrides: Partial<EnrichedCharacter> = {},
): EnrichedCharacter => ({
  id: 1,
  name: "Test Char",
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
          value: "1",
          actionTime: 30,
          damage: [],
        },
        {
          name: "Named",
          category: "Basic Attack",
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
  name: "Echo Skill",
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
const loadouts = [emptyLoadout, emptyLoadout, emptyLoadout]

const STAGE_1_ID =
  "char.test-char.basic-attack.normal-attack.stage-1::basic-attack"
const NAMED_ID = "char.test-char.basic-attack.normal-attack.named::basic-attack"

const reaction = (overrides: Partial<BuffDef>): BuffDef => ({
  id: "char.test-char.x.reaction",
  name: "Reaction",
  trigger: { event: "simStart" },
  effects: [],
  ...overrides,
})

describe("deriveKey", () => {
  it("strips a trailing ' DMG' and kebab-cases", () => {
    expect(deriveKey("Basic Attack 1 DMG")).toBe("basic-attack-1")
    expect(deriveKey("Blade of Howling Squall DMG")).toBe(
      "blade-of-howling-squall",
    )
  })

  it("strips a trailing ' Damage'", () => {
    expect(deriveKey("Heavy Attack Damage")).toBe("heavy-attack")
  })

  it("only strips at the end", () => {
    expect(deriveKey("DMG Boost")).toBe("dmg-boost")
  })

  it("normalizes cast-stage names to 'cast'", () => {
    expect(deriveKey(STAGE_CAST_NAME)).toBe("cast")
    expect(deriveKey("Outro DMG")).toBe("cast")
  })

  it("keeps echo tap/hold names faithful", () => {
    expect(deriveKey("Tap")).toBe("tap")
    expect(deriveKey("Hold")).toBe("hold")
  })
})

describe("buildStageLabels", () => {
  it("labels each compiled stage by skill name and newName", () => {
    testCharacters = [baseChar()]
    const labels = buildStageLabels(slots, loadouts)
    expect(labels.get(STAGE_1_ID)).toBe("Normal Attack")
    expect(labels.get(NAMED_ID)).toBe("Normal Attack · 3rd")
  })
})

describe("compileCharacter — keys and ids", () => {
  it("derives skill and stage keys from names", () => {
    const { stageIndex, refIndex } = compileCharacter(baseChar())
    expect([...stageIndex.keys()]).toEqual([STAGE_1_ID, NAMED_ID])
    expect(refIndex.get("normal-attack")?.get("stage-1")).toBe(STAGE_1_ID)
    expect(refIndex.get("normal-attack")?.get("named")).toBe(NAMED_ID)
  })

  it("computes ids once and memoizes per character object", () => {
    const char = baseChar()
    expect(compileCharacter(char)).toBe(compileCharacter(char))
  })

  it("respects an explicit stage key override", () => {
    const char = baseChar()
    char.skills[0].stages[1] = {
      ...char.skills[0].stages[1],
      name: "Stage 1",
      key: "stage-1-hold",
    }
    const { stageIndex } = compileCharacter(char)
    expect(
      stageIndex.has(
        "char.test-char.basic-attack.normal-attack.stage-1-hold::basic-attack",
      ),
    ).toBe(true)
  })

  it("throws on a duplicate stage key within a skill", () => {
    const char = baseChar()
    char.skills[0].stages[1] = {
      ...char.skills[0].stages[1],
      name: "Stage 1",
    }
    expect(() => compileCharacter(char)).toThrow(/duplicate stage key/)
  })

  it("throws on a duplicate skill key among staged skills", () => {
    const char = baseChar()
    char.skills = [char.skills[0], { ...char.skills[0], id: 2 }]
    expect(() => compileCharacter(char)).toThrow(/duplicate skill key/)
  })

  it("skips stage-less skills entirely", () => {
    const char = baseChar()
    char.skills = [
      ...char.skills,
      { id: 9, name: "", type: "Inherent Skill", stages: [], damage: [] },
    ]
    expect(() => compileCharacter(char)).not.toThrow()
  })

  it("throws on ambiguous buff keys (same last id segment)", () => {
    const char = baseChar({
      buffs: [
        reaction({ id: "char.test-char.a.boost" }),
        reaction({ id: "char.test-char.b.boost" }),
      ],
    })
    expect(() => compileCharacter(char)).toThrow(
      /buff key "boost" is ambiguous/,
    )
  })
})

describe("compileCharacter — reference lowering", () => {
  it("lowers a skill/stage token to the stage id", () => {
    const char = baseChar({
      buffs: [
        reaction({
          trigger: { event: "hitLanded", stage: "normal-attack/stage-1" },
        }),
      ],
    })
    expect(compileCharacter(char).buffs[0].trigger).toEqual({
      event: "hitLanded",
      stageId: STAGE_1_ID,
    })
  })

  it("lowers a named stage token", () => {
    const char = baseChar({
      buffs: [
        reaction({
          trigger: { event: "hitLanded", stage: "normal-attack/named" },
        }),
      ],
    })
    expect(compileCharacter(char).buffs[0].trigger).toEqual({
      event: "hitLanded",
      stageId: NAMED_ID,
    })
  })

  it("lowers a hit-pinned ref to stageId + hitIndex", () => {
    const char = baseChar({
      buffs: [
        reaction({
          trigger: { event: "hitLanded", stage: "normal-attack/named#2" },
        }),
      ],
    })
    expect(compileCharacter(char).buffs[0].trigger).toEqual({
      event: "hitLanded",
      stageId: NAMED_ID,
      hitIndex: 2,
    })
  })

  it("lowers a bare skill token to the skill axis", () => {
    const char = baseChar({
      buffs: [
        reaction({
          trigger: { event: "hitLanded", stage: "normal-attack" },
        }),
      ],
    })
    expect(compileCharacter(char).buffs[0].trigger).toEqual({
      event: "hitLanded",
      skill: "normal-attack",
    })
  })

  it("lowers a buff key reference to the full buff id", () => {
    const char = baseChar({
      buffs: [
        reaction({ id: "char.test-char.flag" }),
        reaction({
          trigger: { event: "simStart" },
          condition: { kind: "buffActive", buff: "flag", on: "source" },
        }),
      ],
    })
    const cond = compileCharacter(char).buffs[1].condition
    expect(cond).toEqual({
      kind: "buffActive",
      buff: "char.test-char.flag",
      on: "source",
    })
  })

  it("lowers appliesToHits and consumedBy the same way", () => {
    const char = baseChar({
      buffs: [
        reaction({
          trigger: { event: "simStart" },
          consumedBy: { event: "hitLanded", stage: "normal-attack/stage-1#1" },
          appliesToHits: { stage: "normal-attack" },
        }),
      ],
    })
    const def = compileCharacter(char).buffs[0]
    expect(def.consumedBy).toEqual({
      event: "hitLanded",
      stageId: STAGE_1_ID,
      hitIndex: 1,
    })
    expect(def.appliesToHits).toEqual({ skill: "normal-attack" })
  })

  it("throws on an unresolvable stage ref", () => {
    const char = baseChar({
      buffs: [
        reaction({
          trigger: { event: "hitLanded", stage: "normal-attack/nope" },
        }),
      ],
    })
    expect(() => compileCharacter(char)).toThrow(/unresolvable stage reference/)
  })

  it("throws on an unresolvable buff ref", () => {
    const char = baseChar({
      buffs: [
        reaction({
          trigger: { event: "simStart" },
          condition: { kind: "buffActive", buff: "nope", on: "source" },
        }),
      ],
    })
    expect(() => compileCharacter(char)).toThrow(/unresolvable buff reference/)
  })

  it("throws on mixed skill/stage granularity in one array", () => {
    const char = baseChar({
      buffs: [
        reaction({
          trigger: {
            event: "hitLanded",
            stage: ["normal-attack/stage-1", "normal-attack"],
          },
        }),
      ],
    })
    expect(() => compileCharacter(char)).toThrow(
      /mixed skill\/stage granularity/,
    )
  })

  it("throws when a skillCast trigger pins a hit", () => {
    const char = baseChar({
      buffs: [
        reaction({
          trigger: { event: "skillCast", stage: "normal-attack/stage-1#1" },
        }),
      ],
    })
    expect(() => compileCharacter(char)).toThrow(/cannot pin a hit index/)
  })

  it("resolves requiresPriorStage and rejects unresolvable ones", () => {
    const char = baseChar()
    char.skills[0].stages[1] = {
      ...char.skills[0].stages[1],
      requiresPriorStage: "normal-attack/stage-1",
    }
    const info = compileCharacter(char).stageIndex.get(NAMED_ID)
    expect(info?.requiresPriorStageId).toEqual([STAGE_1_ID])

    const bad = baseChar()
    bad.skills[0].stages[1] = {
      ...bad.skills[0].stages[1],
      requiresPriorStage: "normal-attack/gone",
    }
    expect(() => compileCharacter(bad)).toThrow(/unresolvable stage reference/)
  })
})

describe("compileEcho", () => {
  it("derives stage keys from names and lowers legacy refs", () => {
    const echo = baseEcho({
      name: "Test Echo",
      skill: {
        cooldown: 20,
        description: "",
        stages: [{ name: "Tap", newName: "", actionTime: 60, damage: [] }],
      },
      buffs: [
        reaction({
          id: "echo.test-echo.bonus",
          trigger: { event: "hitLanded", stage: "tap#3" },
        }),
      ],
    })
    const compiled = compileEcho(echo)
    expect([...compiled.stageIndex.keys()]).toEqual([
      "echo.test-echo.tap::echo-skill",
    ])
    expect(compiled.buffs[0].trigger).toEqual({
      event: "hitLanded",
      stageId: "echo.test-echo.tap::echo-skill",
      hitIndex: 3,
    })
  })
})

describe("findStageByEntry — character skill", () => {
  it("resolves a stage by its key-derived id", () => {
    testCharacters = [baseChar()]
    const entry = { id: "e1", characterId: 1, stageId: STAGE_1_ID }
    const result = findStageByEntry(entry, slots, loadouts)
    expect(result).not.toBeNull()
    expect(result?.stageName).toBe("Stage 1")
    expect(result?.skillType).toBe("Basic Attack")
    expect(result?.skillKey).toBe("normal-attack")
  })

  it("returns null when stageId does not match any stage", () => {
    testCharacters = [baseChar()]
    const entry = {
      id: "e3",
      characterId: 1,
      stageId:
        "char.test-char.basic-attack.normal-attack.missing::basic-attack",
    }
    expect(findStageByEntry(entry, slots, loadouts)).toBeNull()
  })

  it("returns null when characterId is not in catalog", () => {
    testCharacters = []
    const entry = { id: "e4", characterId: 99, stageId: STAGE_1_ID }
    expect(findStageByEntry(entry, slots, loadouts)).toBeNull()
  })

  it("exposes the lowered requiresPriorStageId", () => {
    const char = baseChar()
    char.skills[0].stages[1] = {
      ...char.skills[0].stages[1],
      requiresPriorStage: "normal-attack/stage-1",
    }
    testCharacters = [char]
    const entry = { id: "e5", characterId: 1, stageId: NAMED_ID }
    const result = findStageByEntry(entry, slots, loadouts)
    expect(result?.requiresPriorStageId).toEqual([STAGE_1_ID])
  })

  it("lowers an any-of requiresPriorStage array, resolving each element", () => {
    const char = baseChar()
    char.skills[0].stages[1] = {
      ...char.skills[0].stages[1],
      requiresPriorStage: ["normal-attack/stage-1", "normal-attack/named"],
    }
    const info = compileCharacter(char).stageIndex.get(NAMED_ID)
    expect(info?.requiresPriorStageId).toEqual([STAGE_1_ID, NAMED_ID])
  })

  it("rejects an unresolvable element in an any-of array", () => {
    const char = baseChar()
    char.skills[0].stages[1] = {
      ...char.skills[0].stages[1],
      requiresPriorStage: ["normal-attack/stage-1", "normal-attack/nope"],
    }
    expect(() => compileCharacter(char)).toThrow()
  })
})

describe("findStageByEntry — echo skill", () => {
  it("resolves an echo stage when character is in the slot with that echo", () => {
    testCharacters = [baseChar()]
    testEchoes = [baseEcho()]
    const entry = {
      id: "e6",
      characterId: 1,
      stageId: "echo.echo-skill.echo-stage::echo-skill",
    }
    const result = findStageByEntry(entry, slots, [
      { ...emptyLoadout, echoId: 10 },
      emptyLoadout,
      emptyLoadout,
    ])
    expect(result).not.toBeNull()
    expect(result?.skillType).toBe("Echo Skill")
    expect(result?.element).toBe("Glacio")
  })

  it("returns null when no echo is equipped", () => {
    testCharacters = [baseChar()]
    const entry = {
      id: "e7",
      characterId: 1,
      stageId: "echo.echo-skill.echo-stage::echo-skill",
    }
    expect(findStageByEntry(entry, slots, loadouts)).toBeNull()
  })
})

describe(`findStageByEntry — STAGE_CAST_NAME ("${STAGE_CAST_NAME}") concerto inheritance`, () => {
  const CAST_ID =
    "char.test-char.resonance-skill.resonance-skill.cast::resonance-skill"

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
              category: "Resonance Skill",
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
      { id: "e1", characterId: 1, stageId: CAST_ID },
      slots,
      loadouts,
    )
    expect(result?.concerto).toBe(30)
  })

  it("non-'Skill DMG' stage ignores parent Skill.concerto", () => {
    testCharacters = [makeSkillChar(30, undefined, "Stage 2", "2nd")]
    const result = findStageByEntry(
      {
        id: "e2",
        characterId: 1,
        stageId:
          "char.test-char.resonance-skill.resonance-skill.stage-2::resonance-skill",
      },
      slots,
      loadouts,
    )
    expect(result?.concerto).toBe(0)
  })

  it("'Skill DMG' stage own concerto sums with parent Skill.concerto", () => {
    testCharacters = [makeSkillChar(30, 5, STAGE_CAST_NAME)]
    const result = findStageByEntry(
      { id: "e3", characterId: 1, stageId: CAST_ID },
      slots,
      loadouts,
    )
    expect(result?.concerto).toBe(35)
  })

  it("'Skill DMG' stage skillName equals bare skill.name regardless of newName", () => {
    testCharacters = [makeSkillChar(10, undefined, STAGE_CAST_NAME, "Custom")]
    const result = findStageByEntry(
      { id: "e4", characterId: 1, stageId: CAST_ID },
      slots,
      loadouts,
    )
    expect(result?.skillName).toBe("Resonance Skill")
  })
})

describe("all shipped data compiles", () => {
  it("compiles every character and echo without errors", () => {
    for (const char of ALL_CHARACTERS)
      expect(() => compileCharacter(char)).not.toThrow()
    for (const echo of ALL_ECHOES) expect(() => compileEcho(echo)).not.toThrow()
  })

  it("stage-id snapshot (drift tripwire)", () => {
    const ids = [
      ...ALL_CHARACTERS.flatMap((c) => [
        ...compileCharacter(c).stageIndex.keys(),
      ]),
      ...ALL_ECHOES.flatMap((e) => [...compileEcho(e).stageIndex.keys()]),
    ].sort()
    expect(ids).toMatchSnapshot()
  })
})
