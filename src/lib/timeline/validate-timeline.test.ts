// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { validateTimeline } from "./validate-timeline"
import type { ValidationResult } from "./validate-timeline"

const errorsOf = (r: ValidationResult, id: string) =>
  (r.findings.get(id) ?? []).filter((f) => f.severity === "invalid")
const warningsOf = (r: ValidationResult, id: string) =>
  (r.findings.get(id) ?? []).filter((f) => f.severity === "warning")

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
    expect(result.findings.size).toBe(0)
    expect(result.invalidRowIds.size).toBe(0)
  })
})

describe("validateTimeline — character in team", () => {
  it("marks entry invalid when characterId is not in any slot", () => {
    testCharacters = [baseChar()]
    const e = entry(
      99,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
    )
    const result = validateTimeline([e], [null, null, null], loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(true)
    expect(errorsOf(result, e.id).length).toBeGreaterThan(0)
  })

  it("does not mark entry invalid when characterId is in a slot", () => {
    testCharacters = [baseChar()]
    const e = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
    )
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(false)
    expect(result.findings.get(e.id)).toBeUndefined()
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
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      "valid",
    )
    const invalid = entry(
      99,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
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
      "char.char1.basic-attack.intro-skill.intro-skill::basic-attack",
      "intro",
    )
    const result = validateTimeline([intro], twoCharSlots, twoCharLoadouts)
    expect(result.invalidRowIds.has("intro")).toBe(true)
    expect(errorsOf(result, "intro").length).toBeGreaterThan(0)
  })

  it("flags Intro not immediately preceded by an Outro", () => {
    testCharacters = [charWithAll(1), charWithAll(2)]
    const normal = entry(
      1,
      "char.char1.basic-attack.normal-attack.stage-1::basic-attack",
      "normal",
    )
    const intro = entry(
      2,
      "char.char2.basic-attack.intro-skill.intro-skill::basic-attack",
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
      "char.char1.basic-attack.outro-skill.outro-skill::basic-attack",
      "outro",
    )
    const intro = entry(
      2,
      "char.char2.basic-attack.intro-skill.intro-skill::basic-attack",
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
      "char.char1.basic-attack.outro-skill.outro-skill::basic-attack",
      "outro",
    )
    const result = validateTimeline([outro], [1, null, null], twoCharLoadouts)
    expect(result.invalidRowIds.has("outro")).toBe(false)
  })
})

describe("validateTimeline — stage-reachability (requiresPriorStageId)", () => {
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
              requiresPriorStage: "normal-attack/stage-1",
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
      errorsOf(result, "s2").some(
        (f) => f.message.kind === "missingChainPrereq",
      ),
    ).toBe(true)
  })

  it("carries the prerequisite stage ids on the finding", () => {
    testCharacters = [charWithPrereq(1)]
    const s2 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-2::basic-attack",
      "s2",
    )
    const result = validateTimeline([s2], [1, null, null], loadouts)
    expect(errorsOf(result, "s2")[0].message).toEqual({
      kind: "missingChainPrereq",
      stageId: "char.test.basic-attack.normal-attack.stage-2::basic-attack",
      requiredStageId:
        "char.test.basic-attack.normal-attack.stage-1::basic-attack",
    })
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
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
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

  it("does not flag stages with no requiresPriorStageId", () => {
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

describe("validateTimeline — window mode (minDelay)", () => {
  const STAGE_1 = "char.test.basic-attack.normal-attack.stage-1::basic-attack"
  const STAGE_2 = "char.test.basic-attack.normal-attack.stage-2::basic-attack"
  const SKILL = "char.test.basic-attack.resonance-skill.skill::basic-attack"

  // Stage 2 is a window-mode follow-up to Stage 1: requires a prior Stage 1 on
  // the same character at any distance; minDelay present ⇒ intervening entries
  // (swaps, teammate entries, own actions) do not break the gate.
  const windowChar = (id: number): EnrichedCharacter =>
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
              requiresPriorStage: "normal-attack/stage-1",
              minDelay: 50,
            },
          ],
          damage: [],
        },
        {
          id: 2,
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
    })

  it("accepts the follow-up immediately after its prerequisite", () => {
    testCharacters = [windowChar(1)]
    const result = validateTimeline(
      [entry(1, STAGE_1, "s1"), entry(1, STAGE_2, "s2")],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(false)
  })

  it("accepts the follow-up across a swap-out, teammate entry, and swap-back", () => {
    testCharacters = [windowChar(1), baseChar({ id: 2 })]
    const result = validateTimeline(
      [
        entry(1, STAGE_1, "s1"),
        entry(
          2,
          "char.test.basic-attack.normal-attack.stage-1::basic-attack",
          "tm",
        ),
        entry(1, STAGE_2, "s2"),
      ],
      [1, 2, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(false)
  })

  it("accepts the follow-up when the actor's own action intervenes", () => {
    testCharacters = [windowChar(1)]
    const result = validateTimeline(
      [
        entry(1, STAGE_1, "s1"),
        entry(1, SKILL, "skill"),
        entry(1, STAGE_2, "s2"),
      ],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(false)
  })

  it("flags the follow-up when no prior prerequisite exists on that character", () => {
    testCharacters = [windowChar(1)]
    const result = validateTimeline(
      [entry(1, SKILL, "skill"), entry(1, STAGE_2, "s2")],
      [1, null, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(true)
  })

  it("does not let a teammate's colliding prerequisite satisfy the gate", () => {
    // Both characters share the "Test" name, so their Stage 1 stageIds are
    // byte-identical — only the same-character scoping keeps them apart.
    testCharacters = [windowChar(1), windowChar(2)]
    const result = validateTimeline(
      [entry(2, STAGE_1, "tm-s1"), entry(1, STAGE_2, "s2")],
      [1, 2, null],
      loadouts,
    )
    expect(result.invalidRowIds.has("s2")).toBe(true)
  })
})

describe("validateTimeline — cascade suppression", () => {
  // Chain: Stage 0 -> Stage 1 (req Stage 0) -> Stage 2 (req Stage 1) -> Stage 3 (req Stage 2)
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
              name: "Stage 0",
              category: "Basic Attack",
              newName: "Stage 0",
              value: "1",
              actionTime: 30,
              damage: [],
            },
            {
              name: "Stage 1",
              category: "Basic Attack",
              newName: "Stage 1",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresPriorStage: "normal-attack/stage-0",
            },
            {
              name: "Stage 2",
              category: "Basic Attack",
              newName: "Stage 2",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresPriorStage: "normal-attack/stage-1",
            },
            {
              name: "Stage 3",
              category: "Basic Attack",
              newName: "Stage 3",
              value: "1",
              actionTime: 30,
              damage: [],
              requiresPriorStage: "normal-attack/stage-2",
            },
          ],
          damage: [],
        },
      ],
    })

  it("Stage 1 broken: Stage 2 and Stage 3 are invalid but carry no displayable finding", () => {
    // Stage 0 absent; Stage 1 -> direct invalidation; Stage 2, Stage 3 -> cascade
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

    // Stage 1 has a direct invalidation
    expect(result.invalidRowIds.has("s1")).toBe(true)
    expect(errorsOf(result, "s1").length).toBeGreaterThan(0)

    // Stage 2 is red but message-less
    expect(result.invalidRowIds.has("s2")).toBe(true)
    expect(result.findings.has("s2")).toBe(false)

    // Stage 3 is red but message-less
    expect(result.invalidRowIds.has("s3")).toBe(true)
    expect(result.findings.has("s3")).toBe(false)
  })

  it("an independent invalidation on a later row is not suppressed", () => {
    testCharacters = [chainChar(), baseChar({ id: 2 })]
    const s1 = entry(
      1,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      "s1",
    )
    // char 99 not in team -> independent invalidation
    const independent = entry(
      99,
      "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      "ind",
    )
    const result = validateTimeline(
      [s1, independent],
      [1, null, null],
      loadouts,
    )

    // s1 has direct invalidation (no Stage 0 before it)
    expect(result.findings.has("s1")).toBe(true)
    // independent invalidation is not suppressed
    expect(result.findings.has("ind")).toBe(true)
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
    expect(result.findings.size).toBe(0)
  })
})

// Warning channel: swap -> same-character rule

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
  stageId: "char.test.basic-attack.normal-attack.stage-1::basic-attack",
  variantKind: "swap",
})

const fullEntry = (id: string, characterId = 1): TimelineEntry => ({
  id,
  characterId,
  stageId: "char.test.basic-attack.normal-attack.stage-1::basic-attack",
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

describe("validateTimeline — swap warning channel", () => {
  it("emits a warning when a swap entry is immediately followed by the same character", () => {
    testCharacters = [swapChar()]
    const result = validateTimeline(
      [swapEntry("e1"), fullEntry("e2")],
      [1, null, null],
      emptyLoadoutsW,
    )
    const warnings = warningsOf(result, "e1")
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message.kind).toBe("swapForcesDifferentChar")
  })

  it("emits no warning when the next entry is a different character", () => {
    testCharacters = [swapChar(), baseChar({ id: 2 })]
    const result = validateTimeline(
      [swapEntry("e1"), fullEntry("e2", 2)],
      [1, 2, null],
      emptyLoadoutsW,
    )
    expect(warningsOf(result, "e1")).toHaveLength(0)
  })

  it("emits no warning when the swap entry is the last entry", () => {
    testCharacters = [swapChar()]
    const result = validateTimeline(
      [fullEntry("e1"), swapEntry("e2")],
      [1, null, null],
      emptyLoadoutsW,
    )
    expect(warningsOf(result, "e2")).toHaveLength(0)
  })

  it("emits no warning for a non-swap entry followed by the same character", () => {
    testCharacters = [swapChar()]
    const result = validateTimeline(
      [fullEntry("e1"), fullEntry("e2")],
      [1, null, null],
      emptyLoadoutsW,
    )
    expect(warningsOf(result, "e1")).toHaveLength(0)
  })

  it("warnings do not affect invalidRowIds or invalid findings", () => {
    testCharacters = [swapChar()]
    const result = validateTimeline(
      [swapEntry("e1"), fullEntry("e2")],
      [1, null, null],
      emptyLoadoutsW,
    )
    expect(result.invalidRowIds.size).toBe(0)
    expect(errorsOf(result, "e1")).toHaveLength(0)
    expect(result.findings.size).toBe(1)
  })

  it("requiresPriorStageId is satisfied by a swap-variant preceding entry", () => {
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
                requiresPriorStage: "normal-attack/stage-1",
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
      stageId: "char.test.basic-attack.normal-attack.stage-1::basic-attack",
      variantKind: "swap",
    }
    const e2: TimelineEntry = {
      id: "e2",
      characterId: 1,
      stageId: "char.test.basic-attack.normal-attack.stage-2::basic-attack",
    }
    const result = validateTimeline([e1, e2], [1, null, null], emptyLoadoutsW)
    // swap variant on the preceding entry still satisfies requiresPriorStageId
    expect(result.findings.has("e2")).toBe(false)
    expect(result.invalidRowIds.has("e2")).toBe(false)
  })
})
