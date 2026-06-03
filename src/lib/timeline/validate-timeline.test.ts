import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { validateTimeline } from "./validate-timeline"

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
  name: "Test",
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
          category: "Basic Attack",
          value: "1",
          actionTime: 30,
          damage: [],
        },
      ],
      damage: [],
    },
  ],
  ...overrides,
})

const entry = (
  characterId: number,
  stageId: string,
  id = `${characterId}-${stageId}`,
): TimelineEntry => ({ id, characterId, stageId })

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
const loadouts: [SlotLoadout, SlotLoadout, SlotLoadout] = [
  emptyLoadout,
  emptyLoadout,
  emptyLoadout,
]

describe("validateTimeline — empty", () => {
  it("returns empty result for empty entries", () => {
    const result = validateTimeline([], slots, loadouts)
    expect(result.rowErrors.size).toBe(0)
    expect(result.invalidRowIds.size).toBe(0)
  })
})

describe("validateTimeline — character in team", () => {
  it("marks entry invalid when characterId is not in any slot", () => {
    testCharacters = [baseChar()]
    const e = entry(99, "char.test.basic-attack.normal-attack._::basic-attack")
    const result = validateTimeline([e], [null, null, null], loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(true)
    expect(result.rowErrors.get(e.id)?.length).toBeGreaterThan(0)
  })

  it("does not mark entry invalid when characterId is in a slot", () => {
    testCharacters = [baseChar()]
    const e = entry(1, "char.test.basic-attack.normal-attack._::basic-attack")
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(false)
    expect(result.rowErrors.get(e.id)).toBeUndefined()
  })
})

describe("validateTimeline — skill existence", () => {
  it("marks entry invalid when stageId does not match any stage", () => {
    testCharacters = [baseChar()]
    const e = entry(
      1,
      "char.test.basic-attack.normal-attack.nonexistent::basic-attack",
    )
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(true)
  })
})

describe("validateTimeline — echo skill", () => {
  it("marks Echo Skill invalid when no echo is equipped", () => {
    testCharacters = [baseChar()]
    const e = entry(1, "echo.test-echo.tap::echo-skill")
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(true)
  })
})

describe("validateTimeline — multiple entries", () => {
  it("validates each entry independently", () => {
    testCharacters = [baseChar()]
    const valid = entry(
      1,
      "char.test.basic-attack.normal-attack._::basic-attack",
      "valid",
    )
    const invalid = entry(
      99,
      "char.test.basic-attack.normal-attack._::basic-attack",
      "invalid",
    )
    const result = validateTimeline([valid, invalid], slots, loadouts)
    expect(result.invalidRowIds.has("valid")).toBe(false)
    expect(result.invalidRowIds.has("invalid")).toBe(true)
  })
})

describe("validateTimeline — swap-legality (Intro must follow Outro)", () => {
  const charWithAll = (id: number): EnrichedCharacter =>
    baseChar({
      id,
      name: `Char${id}`,
      skills: [
        {
          id: 10 * id + 1,
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
          ],
          damage: [],
        },
        {
          id: 10 * id + 2,
          name: "Intro Skill",
          type: "Intro Skill",
          stages: [
            {
              name: "Intro Skill",
              category: "Basic Attack",
              value: "1",
              actionTime: 30,
              damage: [],
            },
          ],
          damage: [],
        },
        {
          id: 10 * id + 3,
          name: "Outro Skill",
          type: "Outro Skill",
          stages: [
            {
              name: "Outro Skill",
              category: "Basic Attack",
              value: "1",
              actionTime: 30,
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    })

  const twoCharSlots: Slots = [1, 2, null]
  const twoCharLoadouts: [SlotLoadout, SlotLoadout, SlotLoadout] = [
    emptyLoadout,
    emptyLoadout,
    emptyLoadout,
  ]

  it("flags Intro that opens the timeline (no preceding Outro)", () => {
    testCharacters = [charWithAll(1), charWithAll(2)]
    const intro = entry(
      1,
      "char.char1.basic-attack.intro-skill._::basic-attack",
      "intro",
    )
    const result = validateTimeline([intro], twoCharSlots, twoCharLoadouts)
    expect(result.invalidRowIds.has("intro")).toBe(true)
    expect(result.rowErrors.get("intro")?.length).toBeGreaterThan(0)
  })

  it("flags Intro not immediately preceded by an Outro", () => {
    testCharacters = [charWithAll(1), charWithAll(2)]
    const normal = entry(
      1,
      "char.char1.basic-attack.normal-attack._::basic-attack",
      "normal",
    )
    const intro = entry(
      2,
      "char.char2.basic-attack.intro-skill._::basic-attack",
      "intro",
    )
    const result = validateTimeline(
      [normal, intro],
      twoCharSlots,
      twoCharLoadouts,
    )
    expect(result.invalidRowIds.has("intro")).toBe(true)
    expect(result.invalidRowIds.has("normal")).toBe(false)
  })

  it("accepts Intro immediately preceded by an Outro", () => {
    testCharacters = [charWithAll(1), charWithAll(2)]
    const outro = entry(
      1,
      "char.char1.basic-attack.outro-skill._::basic-attack",
      "outro",
    )
    const intro = entry(
      2,
      "char.char2.basic-attack.intro-skill._::basic-attack",
      "intro",
    )
    const result = validateTimeline(
      [outro, intro],
      twoCharSlots,
      twoCharLoadouts,
    )
    expect(result.invalidRowIds.has("intro")).toBe(false)
    expect(result.invalidRowIds.has("outro")).toBe(false)
  })

  it("does not flag Outro entries", () => {
    testCharacters = [charWithAll(1)]
    const outro = entry(
      1,
      "char.char1.basic-attack.outro-skill._::basic-attack",
      "outro",
    )
    const result = validateTimeline([outro], [1, null, null], twoCharLoadouts)
    expect(result.invalidRowIds.has("outro")).toBe(false)
  })
})

describe("validateTimeline — stage-reachability (requiresStageId)", () => {
  const charWithPrereq = (id: number): EnrichedCharacter =>
    baseChar({
      id,
      skills: [
        {
          id: 1,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage 1 DMG",
              category: "Basic Attack",
              newName: "Stage 1",
              value: "1",
              actionTime: 30,
              damage: [],
            },
            {
              name: "Stage 2 DMG",
              category: "Basic Attack",
              newName: "Stage 2",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId:
                "char.test.basic-attack.normal-attack.stage-1::basic-attack",
            },
          ],
          damage: [],
        },
      ],
    })

  it("flags Stage 2 when no prior entry exists for the character", () => {
    testCharacters = [charWithPrereq(1)]
    const s2 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-2::basic-attack",
      "s2",
    )
    const result = validateTimeline([s2], [1, null, null], loadouts)
    expect(result.invalidRowIds.has("s2")).toBe(true)
    expect(
      result.rowErrors.get("s2")?.some((e) => e.message.includes("requires")),
    ).toBe(true)
  })

  it("flags Stage 2 when the most recent same-character entry is not Stage 1", () => {
    testCharacters = [charWithPrereq(1)]
    const s1 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      "s1",
    )
    const s2a = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-2::basic-attack",
      "s2a",
    )
    const s2b = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-2::basic-attack",
      "s2b",
    )
    const result = validateTimeline([s1, s2a, s2b], [1, null, null], loadouts)
    expect(result.invalidRowIds.has("s2b")).toBe(true)
  })

  it("accepts Stage 2 immediately after Stage 1", () => {
    testCharacters = [charWithPrereq(1)]
    const s1 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      "s1",
    )
    const s2 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-2::basic-attack",
      "s2",
    )
    const result = validateTimeline([s1, s2], [1, null, null], loadouts)
    expect(result.invalidRowIds.has("s2")).toBe(false)
  })

  it("accepts Stage 2 when Stage 1 is separated by a different character's entry", () => {
    testCharacters = [charWithPrereq(1), baseChar({ id: 2 })]
    const s1 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      "s1",
    )
    const other = entry(
      2,
      "char.test.basic-attack.normal-attack._::basic-attack",
      "other",
    )
    const s2 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-2::basic-attack",
      "s2",
    )
    const result = validateTimeline([s1, other, s2], [1, 2, null], loadouts)
    expect(result.invalidRowIds.has("s2")).toBe(false)
    expect(result.invalidRowIds.has("other")).toBe(false)
    expect(result.invalidRowIds.has("s1")).toBe(false)
  })

  it("does not flag stages with no requiresStageId", () => {
    testCharacters = [charWithPrereq(1)]
    const s1 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      "s1",
    )
    const result = validateTimeline([s1], [1, null, null], loadouts)
    expect(result.invalidRowIds.has("s1")).toBe(false)
  })
})

describe("validateTimeline — comboAllows (Movement transparency)", () => {
  const movementChar = (id: number): EnrichedCharacter =>
    baseChar({
      id,
      skills: [
        {
          id: 1,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage 1",
              category: "Basic Attack",
              newName: "Stage 1",
              value: "1",
              actionTime: 30,
              damage: [],
            },
            {
              name: "Stage 2",
              category: "Basic Attack",
              newName: "Stage 2",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId:
                "char.test.basic-attack.normal-attack.stage-1::basic-attack",
              comboAllows: ["Dodge"],
            },
          ],
          damage: [],
        },
        {
          id: 2,
          name: "Dodge",
          type: "Movement",
          stages: [
            {
              name: "Dodge",
              category: "Basic Attack",
              value: "",
              actionTime: 21,
              damage: [],
            },
          ],
          damage: [],
        },
        {
          id: 3,
          name: "Jump",
          type: "Movement",
          stages: [
            {
              name: "Jump",
              category: "Basic Attack",
              value: "",
              actionTime: 18,
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    })

  it("comboAllows: Dodge between Stage 1 and Stage 2 validates green", () => {
    testCharacters = [movementChar(1)]
    const result = validateTimeline(
      [
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-1::basic-attack",
          "s1",
        ),
        entry(1, "char.test.basic-attack.dodge._::basic-attack", "dodge"),
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-2::basic-attack",
          "s2",
        ),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(false)
  })

  it("default omitted comboAllows: Dodge between Stage 1 and Stage 2 validates red", () => {
    const opaqueChar = baseChar({
      id: 1,
      skills: [
        {
          id: 1,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage 1",
              category: "Basic Attack",
              newName: "Stage 1",
              value: "1",
              actionTime: 30,
              damage: [],
            },
            {
              name: "Stage 2",
              category: "Basic Attack",
              newName: "Stage 2",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId:
                "char.test.basic-attack.normal-attack.stage-1::basic-attack",
              // comboAllows omitted â†’ opaque
            },
          ],
          damage: [],
        },
        {
          id: 2,
          name: "Dodge",
          type: "Movement",
          stages: [
            {
              name: "Dodge",
              category: "Basic Attack",
              value: "",
              actionTime: 21,
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    })
    testCharacters = [opaqueChar]
    const result = validateTimeline(
      [
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-1::basic-attack",
          "s1",
        ),
        entry(1, "char.test.basic-attack.dodge._::basic-attack", "dodge"),
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-2::basic-attack",
          "s2",
        ),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(true)
  })

  it("comboAllows: Dodge, Jump between Stage 1 and Stage 2 still validates green", () => {
    const charWithBoth: EnrichedCharacter = {
      ...movementChar(1),
      skills: movementChar(1).skills.map((skill) => {
        if (skill.name !== "Normal Attack") return skill
        return {
          ...skill,
          stages: skill.stages.map((s) => {
            if (s.newName !== "Stage 2") return s
            return { ...s, comboAllows: ["Dodge", "Jump"] as const }
          }),
        }
      }),
    }
    testCharacters = [charWithBoth]
    const result = validateTimeline(
      [
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-1::basic-attack",
          "s1",
        ),
        entry(1, "char.test.basic-attack.dodge._::basic-attack", "dodge"),
        entry(1, "char.test.basic-attack.jump._::basic-attack", "jump"),
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-2::basic-attack",
          "s2",
        ),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(false)
  })

  it("comboAllows Dodge: Jump between Stage 1 and Stage 2 still resets the chain", () => {
    testCharacters = [movementChar(1)]
    const result = validateTimeline(
      [
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-1::basic-attack",
          "s1",
        ),
        entry(1, "char.test.basic-attack.jump._::basic-attack", "jump"),
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-2::basic-attack",
          "s2",
        ),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(true)
  })

  it("non-Movement entry between gate and prerequisite always resets the chain", () => {
    const charWithSkill: EnrichedCharacter = {
      ...movementChar(1),
      skills: [
        ...movementChar(1).skills,
        {
          id: 10,
          name: "Resonance Skill",
          type: "Resonance Skill",
          stages: [
            {
              name: "Skill",
              category: "Basic Attack",
              value: "",
              actionTime: 30,
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charWithSkill]
    const result = validateTimeline(
      [
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-1::basic-attack",
          "s1",
        ),
        entry(
          1,
          "char.test.basic-attack.resonance-skill._::basic-attack",
          "skill",
        ),
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-2::basic-attack",
          "s2",
        ),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(true)
  })

  it("two consecutive Dodges still resolve to the prior real stage", () => {
    testCharacters = [movementChar(1)]
    const result = validateTimeline(
      [
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-1::basic-attack",
          "s1",
        ),
        entry(1, "char.test.basic-attack.dodge._::basic-attack", "d1"),
        entry(1, "char.test.basic-attack.dodge._::basic-attack", "d2"),
        entry(
          1,
          "char.test.basic-attack.normal-attack.stage-2::basic-attack",
          "s2",
        ),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(false)
  })
})

describe("validateTimeline — cascade suppression", () => {
  // Chain: Stage 0 â†’ Stage 1 (req Stage 0) â†’ Stage 2 (req Stage 1) â†’ Stage 3 (req Stage 2)
  const chainChar = (): EnrichedCharacter =>
    baseChar({
      id: 1,
      skills: [
        {
          id: 1,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "S0",
              category: "Basic Attack",
              newName: "Stage 0",
              value: "1",
              actionTime: 30,
              damage: [],
            },
            {
              name: "S1",
              category: "Basic Attack",
              newName: "Stage 1",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId:
                "char.test.basic-attack.normal-attack.stage-0::basic-attack",
            },
            {
              name: "S2",
              category: "Basic Attack",
              newName: "Stage 2",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId:
                "char.test.basic-attack.normal-attack.stage-1::basic-attack",
            },
            {
              name: "S3",
              category: "Basic Attack",
              newName: "Stage 3",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId:
                "char.test.basic-attack.normal-attack.stage-2::basic-attack",
            },
          ],
          damage: [],
        },
      ],
    })

  it("Stage 1 broken: Stage 2 and Stage 3 are in invalidRowIds but have no rowErrors", () => {
    // Stage 0 absent; Stage 1 â†’ direct error; Stage 2, Stage 3 â†’ cascade
    testCharacters = [chainChar()]
    const s1 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      "s1",
    )
    const s2 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-2::basic-attack",
      "s2",
    )
    const s3 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-3::basic-attack",
      "s3",
    )
    const result = validateTimeline([s1, s2, s3], [1, null, null], loadouts)

    // Stage 1 has a direct error
    expect(result.invalidRowIds.has("s1")).toBe(true)
    expect(result.rowErrors.get("s1")?.length).toBeGreaterThan(0)

    // Stage 2 is red but message-less
    expect(result.invalidRowIds.has("s2")).toBe(true)
    expect(result.rowErrors.has("s2")).toBe(false)

    // Stage 3 is red but message-less
    expect(result.invalidRowIds.has("s3")).toBe(true)
    expect(result.rowErrors.has("s3")).toBe(false)
  })

  it("an independent error on a later row is not suppressed", () => {
    testCharacters = [chainChar(), baseChar({ id: 2 })]
    const s1 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      "s1",
    )
    // char 99 not in team â†’ independent error
    const independent = entry(
      99,
      "char.test.basic-attack.normal-attack._::basic-attack",
      "ind",
    )
    const result = validateTimeline(
      [s1, independent],
      [1, null, null],
      loadouts,
    )

    // s1 has direct error (no Stage 0 before it)
    expect(result.rowErrors.has("s1")).toBe(true)
    // independent error is not suppressed
    expect(result.rowErrors.has("ind")).toBe(true)
  })

  it("accepts Stage 2 when Stage 1 is valid (no cascade)", () => {
    testCharacters = [chainChar()]
    const s0 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-0::basic-attack",
      "s0",
    )
    const s1 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      "s1",
    )
    const s2 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-2::basic-attack",
      "s2",
    )
    const result = validateTimeline([s0, s1, s2], [1, null, null], loadouts)
    expect(result.invalidRowIds.size).toBe(0)
    expect(result.rowErrors.size).toBe(0)
  })
})

// â”€â”€ Warning channel: swap â†’ same-character rule (ADR-0018 / issue #178) â”€â”€â”€â”€â”€

const swapChar = (): EnrichedCharacter =>
  baseChar({
    id: 1,
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
            variants: { swap: { actionTime: 10 } },
          },
        ],
        damage: [],
      },
    ],
  })

const swapEntry = (id: string): TimelineEntry => ({
  id,
  characterId: 1,
  stageId: "char.test.basic-attack.normal-attack._::basic-attack",
  variantKind: "swap",
})

const fullEntry = (id: string, characterId = 1): TimelineEntry => ({
  id,
  characterId,
  stageId: "char.test.basic-attack.normal-attack._::basic-attack",
})

const emptyLoadoutsW: SlotLoadout[] = [
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

describe("validateTimeline — swap warning channel (ADR-0018)", () => {
  it("emits a warning when a swap entry is immediately followed by the same character", () => {
    testCharacters = [swapChar()]
    const result = validateTimeline(
      [swapEntry("e1"), fullEntry("e2")],
      [1, null, null],
      emptyLoadoutsW,
    )
    const warnings = result.rowWarnings.get("e1") ?? []
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toMatch(/different character/i)
  })

  it("emits no warning when the next entry is a different character", () => {
    testCharacters = [swapChar(), baseChar({ id: 2 })]
    const result = validateTimeline(
      [swapEntry("e1"), fullEntry("e2", 2)],
      [1, 2, null],
      emptyLoadoutsW,
    )
    expect(result.rowWarnings.get("e1")).toBeUndefined()
  })

  it("emits no warning when the swap entry is the last entry", () => {
    testCharacters = [swapChar()]
    const result = validateTimeline(
      [fullEntry("e1"), swapEntry("e2")],
      [1, null, null],
      emptyLoadoutsW,
    )
    expect(result.rowWarnings.get("e2")).toBeUndefined()
  })

  it("emits no warning for a non-swap entry followed by the same character", () => {
    testCharacters = [swapChar()]
    const result = validateTimeline(
      [fullEntry("e1"), fullEntry("e2")],
      [1, null, null],
      emptyLoadoutsW,
    )
    expect(result.rowWarnings.get("e1")).toBeUndefined()
  })

  it("warnings do not affect invalidRowIds or rowErrors", () => {
    testCharacters = [swapChar()]
    const result = validateTimeline(
      [swapEntry("e1"), fullEntry("e2")],
      [1, null, null],
      emptyLoadoutsW,
    )
    expect(result.invalidRowIds.size).toBe(0)
    expect(result.rowErrors.size).toBe(0)
    expect(result.rowWarnings.size).toBe(1)
  })

  it("requiresStageId is satisfied by a swap-variant preceding entry", () => {
    testCharacters = [
      baseChar({
        id: 1,
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
                variants: { swap: { actionTime: 10 } },
                newName: "first",
              },
              {
                name: "Stage 2",
                category: "Basic Attack",
                value: "1",
                actionTime: 30,
                damage: [],
                newName: "second",
                requiresStageId:
                  "char.test.basic-attack.normal-attack.first::basic-attack",
              },
            ],
            damage: [],
          },
        ],
      }),
    ]
    const e1: TimelineEntry = {
      id: "e1",
      characterId: 1,
      stageId: "char.test.basic-attack.normal-attack.first::basic-attack",
      variantKind: "swap",
    }
    const e2: TimelineEntry = {
      id: "e2",
      characterId: 1,
      stageId: "char.test.basic-attack.normal-attack.second::basic-attack",
    }
    const result = validateTimeline([e1, e2], [1, null, null], emptyLoadoutsW)
    // swap variant on the preceding entry still satisfies requiresStageId
    expect(result.rowErrors.has("e2")).toBe(false)
    expect(result.invalidRowIds.has("e2")).toBe(false)
  })
})

// â”€â”€ Footing walk validation (ADR-0022 slice 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("validateTimeline — footing walk (ADR-0022 slice 1)", () => {
  const footingChar = (): EnrichedCharacter =>
    baseChar({
      id: 1,
      skills: [
        {
          id: 1,
          name: "Ground Move",
          type: "Normal Attack",
          stages: [
            {
              name: "Ground",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
              footing: "ground",
            },
          ],
          damage: [],
        },
        {
          id: 2,
          name: "Air Move",
          type: "Normal Attack",
          stages: [
            {
              name: "Air",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
              footing: "air",
            },
          ],
          damage: [],
        },
        {
          id: 3,
          name: "Launch Move",
          type: "Movement",
          stages: [
            {
              name: "Launch",
              category: "Basic Attack",
              value: "",
              actionTime: 18,
              damage: [],
              footing: { launch: 9 },
            },
          ],
          damage: [],
        },
        {
          id: 4,
          name: "Land Move",
          type: "Normal Attack",
          stages: [
            {
              name: "Land",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
              footing: { land: 10 },
            },
          ],
          damage: [],
        },
        {
          id: 5,
          name: "Neutral Move",
          type: "Normal Attack",
          stages: [
            {
              name: "Neutral",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
            },
          ],
          damage: [],
        },
        {
          id: 6,
          name: "Outro Move",
          type: "Outro Skill",
          stages: [
            {
              name: "Outro",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
            },
          ],
          damage: [],
        },
        {
          id: 7,
          name: "Air Intro",
          type: "Intro Skill",
          stages: [
            {
              name: "AirIntro",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
              footing: "air",
            },
          ],
          damage: [],
        },
        {
          id: 8,
          name: "Ground Intro",
          type: "Intro Skill",
          stages: [
            {
              name: "GroundIntro",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
              footing: "ground",
            },
          ],
          damage: [],
        },
      ],
    })

  const fEntry = (stageId: string, id = stageId): TimelineEntry => ({
    id,
    characterId: 1,
    stageId,
  })

  beforeEach(() => {
    testCharacters = [footingChar()]
  })

  it("hard error: ground â†’ air ('launch/jump required')", () => {
    const result = validateTimeline(
      [fEntry("char.test.basic-attack.air-move._::basic-attack", "air")],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("air")).toBe(true)
    expect(
      result.rowErrors.get("air")?.some((e) => /launch|jump/i.test(e.message)),
    ).toBe(true)
  })

  it("soft fall (not an error): air â†’ launch falls to ground, then launches", () => {
    // A { launch } entered airborne is legal: gravity lands the character (fall
    // frames), then the launch fires at its commit frame. So a second consecutive
    // launch is valid with a fall warning, not the old "already airborne" hard error.
    const result = validateTimeline(
      [
        fEntry("char.test.basic-attack.launch-move._::basic-attack", "launch1"),
        fEntry("char.test.basic-attack.launch-move._::basic-attack", "launch2"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("launch2")).toBe(false)
    expect(result.rowErrors.has("launch2")).toBe(false)
    expect(
      result.rowWarnings.get("launch2")?.some((w) => /fall/i.test(w.message)),
    ).toBe(true)
    expect(result.invalidRowIds.has("launch1")).toBe(false)
  })

  it("hard error: ground â†’ land ('nothing to land from')", () => {
    const result = validateTimeline(
      [fEntry("char.test.basic-attack.land-move._::basic-attack", "land")],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("land")).toBe(true)
    expect(
      result.rowErrors.get("land")?.some((e) => /land/i.test(e.message)),
    ).toBe(true)
  })

  it("valid: Jump (launch) â†’ air â†’ land sequence", () => {
    const result = validateTimeline(
      [
        fEntry("char.test.basic-attack.launch-move._::basic-attack", "launch"),
        fEntry("char.test.basic-attack.air-move._::basic-attack", "air"),
        fEntry("char.test.basic-attack.land-move._::basic-attack", "land"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.size).toBe(0)
    expect(result.rowErrors.size).toBe(0)
  })

  it("footing-transparent stage does not change cursor", () => {
    const result = validateTimeline(
      [
        fEntry(
          "char.test.basic-attack.neutral-move._::basic-attack",
          "neutral",
        ),
        fEntry("char.test.basic-attack.air-move._::basic-attack", "air"),
      ],
      [1, null, null],
      loadouts,
    )
    // Cursor stays ground through the neutral move â†’ air stage hard-errors
    expect(result.invalidRowIds.has("air")).toBe(true)
  })

  it("footing cursor updates across entries: launch sets air, then land is valid", () => {
    const result = validateTimeline(
      [
        fEntry("char.test.basic-attack.launch-move._::basic-attack", "launch"),
        fEntry("char.test.basic-attack.land-move._::basic-attack", "land"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("launch")).toBe(false)
    expect(result.invalidRowIds.has("land")).toBe(false)
  })

  it("soft warning: air cursor â†’ ground stage emits fall-frames annotation", () => {
    const result = validateTimeline(
      [
        fEntry("char.test.basic-attack.launch-move._::basic-attack", "launch"),
        fEntry("char.test.basic-attack.ground-move._::basic-attack", "ground"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("ground")).toBe(false)
    expect(result.rowErrors.has("ground")).toBe(false)
    expect(
      result.rowWarnings.get("ground")?.some((w) => /fall/i.test(w.message)),
    ).toBe(true)
  })

  it("no warning: ground cursor â†’ ground stage (normal grounded stage)", () => {
    const result = validateTimeline(
      [
        fEntry("char.test.basic-attack.ground-move._::basic-attack", "g1"),
        fEntry("char.test.basic-attack.ground-move._::basic-attack", "g2"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.rowWarnings.has("g2")).toBe(false)
  })

  it("no warning: air cursor â†’ air stage", () => {
    const result = validateTimeline(
      [
        fEntry("char.test.basic-attack.launch-move._::basic-attack", "launch"),
        fEntry("char.test.basic-attack.air-move._::basic-attack", "air"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.rowWarnings.has("air")).toBe(false)
  })

  it("Intro exception: aerial Intro from a grounded field is valid (no launch/jump error)", () => {
    // An Intro ignores incoming footing. From a ground cursor, an aerial Intro
    // would normally hard-error "launch/jump required" — but Intros are exempt.
    const result = validateTimeline(
      [
        fEntry("char.test.basic-attack.outro-move._::basic-attack", "outro"),
        fEntry("char.test.basic-attack.air-intro._::basic-attack", "intro"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("intro")).toBe(false)
    expect(result.rowErrors.has("intro")).toBe(false)
    expect(result.rowWarnings.has("intro")).toBe(false)
  })

  it("Intro exception: grounded Intro from an airborne field pays no fall warning", () => {
    // Field goes airborne (launch), then an Outro, then a grounded Intro. A normal
    // grounded stage from air would warn fall frames; the Intro is exempt.
    const result = validateTimeline(
      [
        fEntry("char.test.basic-attack.launch-move._::basic-attack", "launch"),
        fEntry("char.test.basic-attack.outro-move._::basic-attack", "outro"),
        fEntry("char.test.basic-attack.ground-intro._::basic-attack", "intro"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("intro")).toBe(false)
    expect(result.rowWarnings.has("intro")).toBe(false)
  })
})

// â”€â”€ Validator footing snapshot (ADR-0022 slice 3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("validateTimeline — footing snapshot (ADR-0022 slice 3)", () => {
  const snapChar = (id: number): EnrichedCharacter =>
    baseChar({
      id,
      skills: [
        {
          id: id * 10 + 1,
          name: "Aerial Swap",
          type: "Resonance Skill",
          stages: [
            {
              name: "Aerial Swap Stage",
              category: "Basic Attack",
              value: "",
              actionTime: 30,
              damage: [],
              footing: { launch: 15 },
            },
          ],
          damage: [],
        },
        {
          id: id * 10 + 2,
          name: "Ground Move",
          type: "Normal Attack",
          stages: [
            {
              name: "Ground Stage",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
              footing: "ground",
            },
          ],
          damage: [],
        },
      ],
    })

  const twoSnapSlots: Slots = [1, 2, null]
  const twoSnapLoadouts: [SlotLoadout, SlotLoadout, SlotLoadout] = [
    emptyLoadout,
    emptyLoadout,
    emptyLoadout,
  ]

  const fSnap = (
    characterId: number,
    stageId: string,
    id = `${characterId}-${stageId}`,
    variantKind?: "swap",
  ): TimelineEntry => ({ id, characterId, stageId, variantKind })

  beforeEach(() => {
    testCharacters = [snapChar(1), snapChar(2)]
  })

  it("swap-variant footing snapshot: same-char re-entry gets fall warning after charB ground stage", () => {
    // charA (1) aerial swap â†’ cursor stays "ground" (swap defers), snapshot charA â†’ "air"
    // charB (2) ground stage â†’ team "ground" (no change)
    // charA (1) re-enters ground stage â†’ effective footing from snapshot "air" â†’ fall warning
    const result = validateTimeline(
      [
        fSnap(
          1,
          "char.test.basic-attack.aerial-swap._::basic-attack",
          "swap1",
          "swap",
        ),
        fSnap(
          2,
          "char.test.basic-attack.ground-move._::basic-attack",
          "ground2",
        ),
        fSnap(
          1,
          "char.test.basic-attack.ground-move._::basic-attack",
          "ground1",
        ),
      ],
      twoSnapSlots,
      twoSnapLoadouts,
    )
    expect(result.invalidRowIds.has("ground1")).toBe(false)
    expect(
      result.rowWarnings.get("ground1")?.some((w) => /fall/i.test(w.message)),
    ).toBe(true)
  })

  it("swap-variant footing: different character sees entry footing (no fall warning from swap)", () => {
    // charA aerial swap â†’ cursor stays "ground" (swap does not advance team cursor)
    // charB ground stage â†’ charB uses team cursor "ground" â†’ no fall warning
    const result = validateTimeline(
      [
        fSnap(
          1,
          "char.test.basic-attack.aerial-swap._::basic-attack",
          "swap1",
          "swap",
        ),
        fSnap(
          2,
          "char.test.basic-attack.ground-move._::basic-attack",
          "ground2",
        ),
      ],
      twoSnapSlots,
      twoSnapLoadouts,
    )
    expect(result.invalidRowIds.has("ground2")).toBe(false)
    expect(result.rowWarnings.has("ground2")).toBe(false)
  })

  it("snapshot consumed on re-entry: second same-char ground stage does not warn again", () => {
    // charA aerial swap â†’ snapshot "air"
    // charA ground re-entry â†’ snapshot consumed â†’ team footing now "ground"
    // charA second ground stage â†’ no snapshot, team footing "ground" â†’ no fall warning
    const result = validateTimeline(
      [
        fSnap(
          1,
          "char.test.basic-attack.aerial-swap._::basic-attack",
          "swap1",
          "swap",
        ),
        fSnap(
          1,
          "char.test.basic-attack.ground-move._::basic-attack",
          "ground1a",
        ),
        fSnap(
          1,
          "char.test.basic-attack.ground-move._::basic-attack",
          "ground1b",
        ),
      ],
      [1, null, null],
      loadouts,
    )
    expect(
      result.rowWarnings.get("ground1a")?.some((w) => /fall/i.test(w.message)),
    ).toBe(true)
    expect(result.rowWarnings.has("ground1b")).toBe(false)
  })
})

// â”€â”€ Variant-aware exit footing for launch/land stages (ADR-0022 amendment) â”€â”€â”€â”€

describe("validateTimeline — variant-aware exit footing (ADR-0022 amendment)", () => {
  // A character with:
  //   LaunchCancel: { launch: 30 } stage, cancel.actionTime: 20, full actionTime: 40
  //   LaunchFull:   { launch: 30 } stage, no explicit cancel variant
  //   LandCancel:   { land: 25 }   stage, cancel.actionTime: 20, full actionTime: 40
  //   AirStage:     footing: "air"  (requires air entry)
  //   GroundStage:  footing: "ground" (requires ground entry)
  const variantChar = (): EnrichedCharacter =>
    baseChar({
      id: 1,
      skills: [
        {
          id: 1,
          name: "Launch Cancel",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              category: "Basic Attack",
              value: "",
              actionTime: 40,
              damage: [],
              footing: { launch: 30 },
              variants: { cancel: { actionTime: 20 }, swap: { actionTime: 6 } },
            },
          ],
          damage: [],
        },
        {
          id: 2,
          name: "Land Cancel",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              category: "Basic Attack",
              value: "",
              actionTime: 40,
              damage: [],
              footing: { land: 25 },
              variants: { cancel: { actionTime: 20 }, swap: { actionTime: 6 } },
            },
          ],
          damage: [],
        },
        {
          id: 3,
          name: "Air Stage",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
              footing: "air",
            },
          ],
          damage: [],
        },
        {
          id: 4,
          name: "Ground Stage",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
              footing: "ground",
            },
          ],
          damage: [],
        },
      ],
    })

  const cancelEntry = (
    stageId: string,
    id: string,
    variantKind: "cancel" | "instantCancel" | "swap" = "cancel",
  ): TimelineEntry => ({ id, characterId: 1, stageId, variantKind })

  const vEntry = (stageId: string, id = stageId): TimelineEntry => ({
    id,
    characterId: 1,
    stageId,
  })

  beforeEach(() => {
    testCharacters = [variantChar()]
  })

  // cancel of { launch: 30 } with actionTime 20 < 30 â†’ no launch, stays ground
  it("cancel: { launch: N } with actionTime < N exits ground — next ground stage valid", () => {
    const result = validateTimeline(
      [
        cancelEntry(
          "char.test.basic-attack.launch-cancel._::basic-attack",
          "lc",
          "cancel",
        ),
        vEntry("char.test.basic-attack.ground-stage._::basic-attack", "gs"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("gs")).toBe(false)
    expect(result.rowErrors.has("gs")).toBe(false)
  })

  it("cancel: { launch: N } with actionTime < N exits ground — next air stage hard-errors", () => {
    const result = validateTimeline(
      [
        cancelEntry(
          "char.test.basic-attack.launch-cancel._::basic-attack",
          "lc",
          "cancel",
        ),
        vEntry("char.test.basic-attack.air-stage._::basic-attack", "as"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("as")).toBe(true)
    expect(
      result.rowErrors.get("as")?.some((e) => /launch|jump/i.test(e.message)),
    ).toBe(true)
  })

  // cancel of { land: 25 } with actionTime 20 < 25 â†’ no land, stays air (entered from air)
  it("cancel: { land: N } with actionTime < N exits air — next air stage valid", () => {
    const result = validateTimeline(
      [
        // First get to air via a full launch (actionTime 40 â‰¥ launch frame 30)
        vEntry(
          "char.test.basic-attack.launch-cancel._::basic-attack",
          "launch",
        ),
        cancelEntry(
          "char.test.basic-attack.land-cancel._::basic-attack",
          "lc",
          "cancel",
        ),
        vEntry("char.test.basic-attack.air-stage._::basic-attack", "as"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("as")).toBe(false)
  })

  it("cancel: { land: N } with actionTime < N exits air — next ground stage gets fall warning not hard error", () => {
    const result = validateTimeline(
      [
        vEntry(
          "char.test.basic-attack.launch-cancel._::basic-attack",
          "launch",
        ),
        cancelEntry(
          "char.test.basic-attack.land-cancel._::basic-attack",
          "lc",
          "cancel",
        ),
        vEntry("char.test.basic-attack.ground-stage._::basic-attack", "gs"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("gs")).toBe(false)
    expect(
      result.rowWarnings.get("gs")?.some((w) => /fall/i.test(w.message)),
    ).toBe(true)
  })

  // Full variant of { launch: 30 } with actionTime 40 â‰¥ 30 â†’ launch commits, exits air
  it("full: { launch: N } with actionTime >= N exits air — next air stage valid", () => {
    const result = validateTimeline(
      [
        vEntry(
          "char.test.basic-attack.launch-cancel._::basic-attack",
          "launch",
        ),
        vEntry("char.test.basic-attack.air-stage._::basic-attack", "as"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("as")).toBe(false)
    expect(result.rowErrors.has("as")).toBe(false)
  })

  // swap of { launch: N } — cursor stays at entry footing; snapshot = "air"
  it("swap: { launch: N } cursor exit is entry footing; next-character sees entry footing", () => {
    const char2 = baseChar({
      id: 2,
      skills: [
        {
          id: 21,
          name: "Ground Move",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              category: "Basic Attack",
              value: "",
              actionTime: 20,
              damage: [],
              footing: "ground",
            },
          ],
          damage: [],
        },
      ],
    })
    testCharacters = [variantChar(), char2]
    const result = validateTimeline(
      [
        cancelEntry(
          "char.test.basic-attack.launch-cancel._::basic-attack",
          "lc",
          "swap",
        ),
        {
          id: "g2",
          characterId: 2,
          stageId: "char.test.basic-attack.ground-move._::basic-attack",
        },
      ],
      [1, 2, null],
      [emptyLoadout, emptyLoadout, emptyLoadout],
    )
    // charB sees entry footing "ground" â†’ no hard error, no fall warning
    expect(result.invalidRowIds.has("g2")).toBe(false)
    expect(result.rowWarnings.has("g2")).toBe(false)
  })

  it("swap: { launch: N } same-character re-entry reads snapshot (air)", () => {
    const result = validateTimeline(
      [
        cancelEntry(
          "char.test.basic-attack.launch-cancel._::basic-attack",
          "lc",
          "swap",
        ),
        vEntry("char.test.basic-attack.ground-stage._::basic-attack", "gs"),
      ],
      [1, null, null],
      loadouts,
    )
    // charA re-entry reads snapshot "air" â†’ fall warning on ground stage
    expect(result.invalidRowIds.has("gs")).toBe(false)
    expect(
      result.rowWarnings.get("gs")?.some((w) => /fall/i.test(w.message)),
    ).toBe(true)
  })
})
