import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { validateTimeline } from "./validate-timeline"

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
  skillType: string,
  skillName: string,
  id = `${characterId}-${skillType}`,
): TimelineEntry => ({
  id,
  characterId,
  skillType,
  skillName,
  attackType: skillType,
  actionTime: 30,
  multiplier: 1,
})

const emptyLoadout: SlotLoadout = {
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetId: null,
  sequence: 0,
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
    const e = entry(99, "Normal Attack", "Normal Attack")
    const result = validateTimeline([e], [null, null, null], loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(true)
    expect(result.rowErrors.get(e.id)?.length).toBeGreaterThan(0)
  })

  it("does not mark entry invalid when characterId is in a slot", () => {
    testCharacters = [baseChar()]
    const e = entry(1, "Normal Attack", "Normal Attack")
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(false)
    expect(result.rowErrors.get(e.id)).toBeUndefined()
  })

  it("accepts character in second or third slot", () => {
    testCharacters = [baseChar({ id: 2 })]
    const e = entry(2, "Normal Attack", "Normal Attack")
    const result = validateTimeline([e], [null, 2, null], loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(false)
  })
})

describe("validateTimeline — skill existence", () => {
  it("marks entry invalid when skill name does not match any stage", () => {
    testCharacters = [baseChar()]
    const e = entry(1, "Normal Attack", "Nonexistent Skill")
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
    const e = entry(1, "Heavy Attack", "Heavy Attack · Charged")
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
    const e = entry(1, "Normal Attack", "Normal Attack (Stage 2)")
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
        set: "Test Set",
        buffs: [],
        skill: {
          cooldown: 20,
          description: "Test",
          stages: [{ name: "Tap", newName: "Tap", actionTime: 30, damage: [] }],
        },
      },
    ]
    const e = entry(1, "Echo Skill", "Test Echo · Tap")
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
    const e = entry(1, "Echo Skill", "Test Echo · Tap")
    const result = validateTimeline([e], slots, loadouts)
    expect(result.invalidRowIds.has(e.id)).toBe(true)
  })
})

describe("validateTimeline — multiple entries", () => {
  it("validates each entry independently", () => {
    testCharacters = [baseChar()]
    const valid = entry(1, "Normal Attack", "Normal Attack", "valid")
    const invalid = entry(99, "Normal Attack", "Normal Attack", "invalid")
    const result = validateTimeline([valid, invalid], slots, loadouts)
    expect(result.invalidRowIds.has("valid")).toBe(false)
    expect(result.invalidRowIds.has("invalid")).toBe(true)
  })
})

describe("validateTimeline — swap-legality (Intro must follow Outro)", () => {
  const introStage = {
    name: "Intro Skill",
    value: "1",
    actionTime: 30,
    damage: [],
  }
  const outroStage = {
    name: "Outro Skill",
    value: "1",
    actionTime: 30,
    damage: [],
  }
  const normalStage = {
    name: "Stage 1",
    value: "1",
    actionTime: 30,
    damage: [],
  }

  const charWithAll = (id: number): EnrichedCharacter =>
    baseChar({
      id,
      name: `Char${id}`,
      skills: [
        {
          id: 10 * id + 1,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [normalStage],
          damage: [],
        },
        {
          id: 10 * id + 2,
          name: "Intro Skill",
          type: "Intro Skill",
          stages: [introStage],
          damage: [],
        },
        {
          id: 10 * id + 3,
          name: "Outro Skill",
          type: "Outro Skill",
          stages: [outroStage],
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
    const intro = entry(1, "Intro Skill", "Intro Skill", "intro")
    const result = validateTimeline([intro], twoCharSlots, twoCharLoadouts)
    expect(result.invalidRowIds.has("intro")).toBe(true)
    expect(result.rowErrors.get("intro")?.length).toBeGreaterThan(0)
  })

  it("flags Intro not immediately preceded by an Outro", () => {
    testCharacters = [charWithAll(1), charWithAll(2)]
    const normal = entry(1, "Normal Attack", "Normal Attack", "normal")
    const intro = entry(2, "Intro Skill", "Intro Skill", "intro")
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
    const outro = entry(1, "Outro Skill", "Outro Skill", "outro")
    const intro = entry(2, "Intro Skill", "Intro Skill", "intro")
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
    const outro = entry(1, "Outro Skill", "Outro Skill", "outro")
    const result = validateTimeline([outro], [1, null, null], twoCharLoadouts)
    expect(result.invalidRowIds.has("outro")).toBe(false)
  })

  it("accepts Intro preceded by Outro from the same character", () => {
    testCharacters = [charWithAll(1)]
    const outro = entry(1, "Outro Skill", "Outro Skill", "outro")
    const intro = entry(1, "Intro Skill", "Intro Skill", "intro")
    const result = validateTimeline(
      [outro, intro],
      [1, null, null],
      twoCharLoadouts,
    )
    expect(result.invalidRowIds.has("intro")).toBe(false)
  })
})
