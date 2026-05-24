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
      stages: [{ name: "Stage 1", value: "1", actionTime: 30, damage: [] }],
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
    const e = entry(99, "Normal Attack::_")
    const result = validateTimeline([e], [null, null, null], loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(true)
    expect(result.rowErrors.get(e.id)?.length).toBeGreaterThan(0)
  })

  it("does not mark entry invalid when characterId is in a slot", () => {
    testCharacters = [baseChar()]
    const e = entry(1, "Normal Attack::_")
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(false)
    expect(result.rowErrors.get(e.id)).toBeUndefined()
  })

  it("accepts character in second or third slot", () => {
    testCharacters = [baseChar({ id: 2 })]
    const e = entry(2, "Normal Attack::_")
    const result = validateTimeline([e], [null, 2, null], loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(false)
  })
})

describe("validateTimeline — skill existence", () => {
  it("marks entry invalid when stageId does not match any stage", () => {
    testCharacters = [baseChar()]
    const e = entry(1, "Normal Attack::Nonexistent")
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(true)
  })

  it("accepts a stage with a newName using dot separator", () => {
    testCharacters = [
      baseChar({
        skills: [
          {
            id: 1,
            name: "Heavy Attack",
            type: "Heavy Attack",
            stages: [
              {
                name: "Stage 1",
                value: "1",
                newName: "Charged",
                actionTime: 30,
                damage: [],
              },
            ],
            damage: [],
          },
        ],
      }),
    ]
    const e = entry(1, "Heavy Attack::Charged")
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(false)
  })

  it("accepts a stage whose newName starts with parenthesis", () => {
    testCharacters = [
      baseChar({
        skills: [
          {
            id: 1,
            name: "Normal Attack",
            type: "Normal Attack",
            stages: [
              {
                name: "Stage 2",
                value: "1",
                newName: "(Stage 2)",
                actionTime: 30,
                damage: [],
              },
            ],
            damage: [],
          },
        ],
      }),
    ]
    const e = entry(1, "Normal Attack::(Stage 2)")
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(false)
  })
})

describe("validateTimeline — echo skill", () => {
  it("accepts an Echo Skill entry when the slot has a matching echo", () => {
    testCharacters = [baseChar()]
    testEchoes = [
      {
        id: 10,
        name: "Test Echo",
        cost: 4,
        element: "Fusion",
        sets: ["Test Set"],
        buffs: [],
        skill: {
          cooldown: 20,
          description: "Test",
          stages: [{ name: "Tap", newName: "Tap", actionTime: 30, damage: [] }],
        },
      },
    ]
    const e = entry(1, "Test Echo::Tap")
    const loadoutsWithEcho: [SlotLoadout, SlotLoadout, SlotLoadout] = [
      { ...emptyLoadout, echoId: 10 },
      emptyLoadout,
      emptyLoadout,
    ]
    const result = validateTimeline([e], slots, loadoutsWithEcho)
    expect(result.invalidRowIds.has(e.id)).toBe(false)
  })

  it("marks Echo Skill invalid when no echo is equipped", () => {
    testCharacters = [baseChar()]
    const e = entry(1, "Test Echo::Tap")
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(true)
  })
})

describe("validateTimeline — multiple entries", () => {
  it("validates each entry independently", () => {
    testCharacters = [baseChar()]
    const valid = entry(1, "Normal Attack::_", "valid")
    const invalid = entry(99, "Normal Attack::_", "invalid")
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
          stages: [{ name: "Stage 1", value: "1", actionTime: 30, damage: [] }],
          damage: [],
        },
        {
          id: 10 * id + 2,
          name: "Intro Skill",
          type: "Intro Skill",
          stages: [
            { name: "Intro Skill", value: "1", actionTime: 30, damage: [] },
          ],
          damage: [],
        },
        {
          id: 10 * id + 3,
          name: "Outro Skill",
          type: "Outro Skill",
          stages: [
            { name: "Outro Skill", value: "1", actionTime: 30, damage: [] },
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
    const intro = entry(1, "Intro Skill::_", "intro")
    const result = validateTimeline([intro], twoCharSlots, twoCharLoadouts)
    expect(result.invalidRowIds.has("intro")).toBe(true)
    expect(result.rowErrors.get("intro")?.length).toBeGreaterThan(0)
  })

  it("flags Intro not immediately preceded by an Outro", () => {
    testCharacters = [charWithAll(1), charWithAll(2)]
    const normal = entry(1, "Normal Attack::_", "normal")
    const intro = entry(2, "Intro Skill::_", "intro")
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
    const outro = entry(1, "Outro Skill::_", "outro")
    const intro = entry(2, "Intro Skill::_", "intro")
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
    const outro = entry(1, "Outro Skill::_", "outro")
    const result = validateTimeline([outro], [1, null, null], twoCharLoadouts)
    expect(result.invalidRowIds.has("outro")).toBe(false)
  })

  it("accepts Intro preceded by Outro from the same character", () => {
    testCharacters = [charWithAll(1)]
    const outro = entry(1, "Outro Skill::_", "outro")
    const intro = entry(1, "Intro Skill::_", "intro")
    const result = validateTimeline(
      [outro, intro],
      [1, null, null],
      twoCharLoadouts,
    )
    expect(result.invalidRowIds.has("intro")).toBe(false)
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
              newName: "Stage 1",
              value: "1",
              actionTime: 30,
              damage: [],
            },
            {
              name: "Stage 2 DMG",
              newName: "Stage 2",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId: "Normal Attack::Stage 1",
            },
          ],
          damage: [],
        },
      ],
    })

  it("flags Stage 2 when no prior entry exists for the character", () => {
    testCharacters = [charWithPrereq(1)]
    const s2 = entry(1, "Normal Attack::Stage 2", "s2")
    const result = validateTimeline([s2], [1, null, null], loadouts)
    expect(result.invalidRowIds.has("s2")).toBe(true)
    expect(
      result.rowErrors.get("s2")?.some((e) => e.message.includes("requires")),
    ).toBe(true)
  })

  it("flags Stage 2 when the most recent same-character entry is not Stage 1", () => {
    testCharacters = [charWithPrereq(1)]
    const s1 = entry(1, "Normal Attack::Stage 1", "s1")
    const s2a = entry(1, "Normal Attack::Stage 2", "s2a")
    const s2b = entry(1, "Normal Attack::Stage 2", "s2b")
    const result = validateTimeline([s1, s2a, s2b], [1, null, null], loadouts)
    expect(result.invalidRowIds.has("s2b")).toBe(true)
  })

  it("accepts Stage 2 immediately after Stage 1", () => {
    testCharacters = [charWithPrereq(1)]
    const s1 = entry(1, "Normal Attack::Stage 1", "s1")
    const s2 = entry(1, "Normal Attack::Stage 2", "s2")
    const result = validateTimeline([s1, s2], [1, null, null], loadouts)
    expect(result.invalidRowIds.has("s2")).toBe(false)
  })

  it("accepts Stage 2 when Stage 1 is separated by a different character's entry", () => {
    testCharacters = [charWithPrereq(1), baseChar({ id: 2 })]
    const s1 = entry(1, "Normal Attack::Stage 1", "s1")
    const other = entry(2, "Normal Attack::_", "other")
    const s2 = entry(1, "Normal Attack::Stage 2", "s2")
    const result = validateTimeline([s1, other, s2], [1, 2, null], loadouts)
    expect(result.invalidRowIds.has("s2")).toBe(false)
    expect(result.invalidRowIds.has("other")).toBe(false)
    expect(result.invalidRowIds.has("s1")).toBe(false)
  })

  it("does not flag stages with no requiresStageId", () => {
    testCharacters = [charWithPrereq(1)]
    const s1 = entry(1, "Normal Attack::Stage 1", "s1")
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
              newName: "Stage 1",
              value: "1",
              actionTime: 30,
              damage: [],
            },
            {
              name: "Stage 2",
              newName: "Stage 2",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId: "Normal Attack::Stage 1",
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
        entry(1, "Normal Attack::Stage 1", "s1"),
        entry(1, "Dodge::_", "dodge"),
        entry(1, "Normal Attack::Stage 2", "s2"),
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
              newName: "Stage 1",
              value: "1",
              actionTime: 30,
              damage: [],
            },
            {
              name: "Stage 2",
              newName: "Stage 2",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId: "Normal Attack::Stage 1",
              // comboAllows omitted → opaque
            },
          ],
          damage: [],
        },
        {
          id: 2,
          name: "Dodge",
          type: "Movement",
          stages: [{ name: "Dodge", value: "", actionTime: 21, damage: [] }],
          damage: [],
        },
      ],
    })
    testCharacters = [opaqueChar]
    const result = validateTimeline(
      [
        entry(1, "Normal Attack::Stage 1", "s1"),
        entry(1, "Dodge::_", "dodge"),
        entry(1, "Normal Attack::Stage 2", "s2"),
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
        entry(1, "Normal Attack::Stage 1", "s1"),
        entry(1, "Dodge::_", "dodge"),
        entry(1, "Jump::_", "jump"),
        entry(1, "Normal Attack::Stage 2", "s2"),
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
        entry(1, "Normal Attack::Stage 1", "s1"),
        entry(1, "Jump::_", "jump"),
        entry(1, "Normal Attack::Stage 2", "s2"),
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
          stages: [{ name: "Skill", value: "", actionTime: 30, damage: [] }],
          damage: [],
        },
      ],
    }
    testCharacters = [charWithSkill]
    const result = validateTimeline(
      [
        entry(1, "Normal Attack::Stage 1", "s1"),
        entry(1, "Resonance Skill::_", "skill"),
        entry(1, "Normal Attack::Stage 2", "s2"),
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
        entry(1, "Normal Attack::Stage 1", "s1"),
        entry(1, "Dodge::_", "d1"),
        entry(1, "Dodge::_", "d2"),
        entry(1, "Normal Attack::Stage 2", "s2"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(false)
  })
})

describe("validateTimeline — cascade suppression", () => {
  // Chain: Stage 0 → Stage 1 (req Stage 0) → Stage 2 (req Stage 1) → Stage 3 (req Stage 2)
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
              newName: "Stage 0",
              value: "1",
              actionTime: 30,
              damage: [],
            },
            {
              name: "S1",
              newName: "Stage 1",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId: "Normal Attack::Stage 0",
            },
            {
              name: "S2",
              newName: "Stage 2",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId: "Normal Attack::Stage 1",
            },
            {
              name: "S3",
              newName: "Stage 3",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresStageId: "Normal Attack::Stage 2",
            },
          ],
          damage: [],
        },
      ],
    })

  it("Stage 1 broken: Stage 2 and Stage 3 are in invalidRowIds but have no rowErrors", () => {
    // Stage 0 absent; Stage 1 → direct error; Stage 2, Stage 3 → cascade
    testCharacters = [chainChar()]
    const s1 = entry(1, "Normal Attack::Stage 1", "s1")
    const s2 = entry(1, "Normal Attack::Stage 2", "s2")
    const s3 = entry(1, "Normal Attack::Stage 3", "s3")
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
    const s1 = entry(1, "Normal Attack::Stage 1", "s1")
    // char 99 not in team → independent error
    const independent = entry(99, "Normal Attack::_", "ind")
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
    const s0 = entry(1, "Normal Attack::Stage 0", "s0")
    const s1 = entry(1, "Normal Attack::Stage 1", "s1")
    const s2 = entry(1, "Normal Attack::Stage 2", "s2")
    const result = validateTimeline([s0, s1, s2], [1, null, null], loadouts)
    expect(result.invalidRowIds.size).toBe(0)
    expect(result.rowErrors.size).toBe(0)
  })
})

// ── Warning channel: swap → same-character rule (ADR-0018 / issue #178) ─────

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
  stageId: "Normal Attack::_",
  variantKind: "swap",
})

const fullEntry = (id: string, characterId = 1): TimelineEntry => ({
  id,
  characterId,
  stageId: "Normal Attack::_",
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
                value: "1",
                actionTime: 30,
                damage: [],
                variants: { swap: { actionTime: 10 } },
                newName: "first",
              },
              {
                name: "Stage 2",
                value: "1",
                actionTime: 30,
                damage: [],
                newName: "second",
                requiresStageId: "Normal Attack::first",
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
      stageId: "Normal Attack::first",
      variantKind: "swap",
    }
    const e2: TimelineEntry = {
      id: "e2",
      characterId: 1,
      stageId: "Normal Attack::second",
    }
    const result = validateTimeline([e1, e2], [1, null, null], emptyLoadoutsW)
    // swap variant on the preceding entry still satisfies requiresStageId
    expect(result.rowErrors.has("e2")).toBe(false)
    expect(result.invalidRowIds.has("e2")).toBe(false)
  })
})

// ── Footing walk validation (ADR-0022 slice 1) ────────────────────────────────

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
          stages: [{ name: "Neutral", value: "", actionTime: 20, damage: [] }],
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

  it("hard error: ground → air ('launch/jump required')", () => {
    const result = validateTimeline(
      [fEntry("Air Move::_", "air")],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("air")).toBe(true)
    expect(
      result.rowErrors.get("air")?.some((e) => /launch|jump/i.test(e.message)),
    ).toBe(true)
  })

  it("hard error: air → launch ('already airborne')", () => {
    const result = validateTimeline(
      [
        fEntry("Launch Move::_", "launch1"),
        fEntry("Launch Move::_", "launch2"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("launch2")).toBe(true)
    expect(
      result.rowErrors.get("launch2")?.some((e) => /airborne/i.test(e.message)),
    ).toBe(true)
    expect(result.invalidRowIds.has("launch1")).toBe(false)
  })

  it("hard error: ground → land ('nothing to land from')", () => {
    const result = validateTimeline(
      [fEntry("Land Move::_", "land")],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("land")).toBe(true)
    expect(
      result.rowErrors.get("land")?.some((e) => /land/i.test(e.message)),
    ).toBe(true)
  })

  it("no error: air → ground (fall padding, not flagged in slice 1)", () => {
    const result = validateTimeline(
      [fEntry("Launch Move::_", "launch"), fEntry("Ground Move::_", "ground")],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("launch")).toBe(false)
    expect(result.invalidRowIds.has("ground")).toBe(false)
  })

  it("valid: Jump (launch) → air → land sequence", () => {
    const result = validateTimeline(
      [
        fEntry("Launch Move::_", "launch"),
        fEntry("Air Move::_", "air"),
        fEntry("Land Move::_", "land"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.size).toBe(0)
    expect(result.rowErrors.size).toBe(0)
  })

  it("footing-transparent stage does not change cursor", () => {
    const result = validateTimeline(
      [fEntry("Neutral Move::_", "neutral"), fEntry("Air Move::_", "air")],
      [1, null, null],
      loadouts,
    )
    // Cursor stays ground through the neutral move → air stage hard-errors
    expect(result.invalidRowIds.has("air")).toBe(true)
  })

  it("footing cursor updates across entries: launch sets air, then land is valid", () => {
    const result = validateTimeline(
      [fEntry("Launch Move::_", "launch"), fEntry("Land Move::_", "land")],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("launch")).toBe(false)
    expect(result.invalidRowIds.has("land")).toBe(false)
  })

  it("soft warning: air cursor → ground stage emits fall-frames annotation", () => {
    const result = validateTimeline(
      [fEntry("Launch Move::_", "launch"), fEntry("Ground Move::_", "ground")],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("ground")).toBe(false)
    expect(result.rowErrors.has("ground")).toBe(false)
    expect(
      result.rowWarnings.get("ground")?.some((w) => /fall/i.test(w.message)),
    ).toBe(true)
  })

  it("no warning: ground cursor → ground stage (normal grounded stage)", () => {
    const result = validateTimeline(
      [fEntry("Ground Move::_", "g1"), fEntry("Ground Move::_", "g2")],
      [1, null, null],
      loadouts,
    )
    expect(result.rowWarnings.has("g2")).toBe(false)
  })

  it("no warning: air cursor → air stage", () => {
    const result = validateTimeline(
      [fEntry("Launch Move::_", "launch"), fEntry("Air Move::_", "air")],
      [1, null, null],
      loadouts,
    )
    expect(result.rowWarnings.has("air")).toBe(false)
  })
})

// ── Validator footing snapshot (ADR-0022 slice 3) ───────────────────────────

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
    // charA (1) aerial swap → cursor stays "ground" (swap defers), snapshot charA → "air"
    // charB (2) ground stage → team "ground" (no change)
    // charA (1) re-enters ground stage → effective footing from snapshot "air" → fall warning
    const result = validateTimeline(
      [
        fSnap(1, "Aerial Swap::_", "swap1", "swap"),
        fSnap(2, "Ground Move::_", "ground2"),
        fSnap(1, "Ground Move::_", "ground1"),
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
    // charA aerial swap → cursor stays "ground" (swap does not advance team cursor)
    // charB ground stage → charB uses team cursor "ground" → no fall warning
    const result = validateTimeline(
      [
        fSnap(1, "Aerial Swap::_", "swap1", "swap"),
        fSnap(2, "Ground Move::_", "ground2"),
      ],
      twoSnapSlots,
      twoSnapLoadouts,
    )
    expect(result.invalidRowIds.has("ground2")).toBe(false)
    expect(result.rowWarnings.has("ground2")).toBe(false)
  })

  it("snapshot consumed on re-entry: second same-char ground stage does not warn again", () => {
    // charA aerial swap → snapshot "air"
    // charA ground re-entry → snapshot consumed → team footing now "ground"
    // charA second ground stage → no snapshot, team footing "ground" → no fall warning
    const result = validateTimeline(
      [
        fSnap(1, "Aerial Swap::_", "swap1", "swap"),
        fSnap(1, "Ground Move::_", "ground1a"),
        fSnap(1, "Ground Move::_", "ground1b"),
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

// ── Variant-aware exit footing for launch/land stages (ADR-0022 amendment) ────

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

  // cancel of { launch: 30 } with actionTime 20 < 30 → no launch, stays ground
  it("cancel: { launch: N } with actionTime < N exits ground — next ground stage valid", () => {
    const result = validateTimeline(
      [
        cancelEntry("Launch Cancel::_", "lc", "cancel"),
        vEntry("Ground Stage::_", "gs"),
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
        cancelEntry("Launch Cancel::_", "lc", "cancel"),
        vEntry("Air Stage::_", "as"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("as")).toBe(true)
    expect(
      result.rowErrors.get("as")?.some((e) => /launch|jump/i.test(e.message)),
    ).toBe(true)
  })

  // cancel of { land: 25 } with actionTime 20 < 25 → no land, stays air (entered from air)
  it("cancel: { land: N } with actionTime < N exits air — next air stage valid", () => {
    const result = validateTimeline(
      [
        // First get to air via a full launch (actionTime 40 ≥ launch frame 30)
        vEntry("Launch Cancel::_", "launch"),
        cancelEntry("Land Cancel::_", "lc", "cancel"),
        vEntry("Air Stage::_", "as"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("as")).toBe(false)
  })

  it("cancel: { land: N } with actionTime < N exits air — next ground stage gets fall warning not hard error", () => {
    const result = validateTimeline(
      [
        vEntry("Launch Cancel::_", "launch"),
        cancelEntry("Land Cancel::_", "lc", "cancel"),
        vEntry("Ground Stage::_", "gs"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("gs")).toBe(false)
    expect(
      result.rowWarnings.get("gs")?.some((w) => /fall/i.test(w.message)),
    ).toBe(true)
  })

  // Full variant of { launch: 30 } with actionTime 40 ≥ 30 → launch commits, exits air
  it("full: { launch: N } with actionTime >= N exits air — next air stage valid", () => {
    const result = validateTimeline(
      [vEntry("Launch Cancel::_", "launch"), vEntry("Air Stage::_", "as")],
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
        cancelEntry("Launch Cancel::_", "lc", "swap"),
        { id: "g2", characterId: 2, stageId: "Ground Move::_" },
      ],
      [1, 2, null],
      [emptyLoadout, emptyLoadout, emptyLoadout],
    )
    // charB sees entry footing "ground" → no hard error, no fall warning
    expect(result.invalidRowIds.has("g2")).toBe(false)
    expect(result.rowWarnings.has("g2")).toBe(false)
  })

  it("swap: { launch: N } same-character re-entry reads snapshot (air)", () => {
    const result = validateTimeline(
      [
        cancelEntry("Launch Cancel::_", "lc", "swap"),
        vEntry("Ground Stage::_", "gs"),
      ],
      [1, null, null],
      loadouts,
    )
    // charA re-entry reads snapshot "air" → fall warning on ground stage
    expect(result.invalidRowIds.has("gs")).toBe(false)
    expect(
      result.rowWarnings.get("gs")?.some((w) => /fall/i.test(w.message)),
    ).toBe(true)
  })
})
