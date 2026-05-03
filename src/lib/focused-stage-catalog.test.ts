import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"

import { getFocusedStageCatalog } from "./focused-stage-catalog"

const char1: EnrichedCharacter = {
  id: 1,
  name: "Encore",
  element: "Fusion",
  weaponType: "Rectifier",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 0, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 101,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage 1",
          value: "1",
          actionTime: 12,
          damage: [
            {
              type: "Basic Attack",
              dmgType: "Physical",
              scalingStat: "ATK",
              actionFrame: 0,
              value: 1.5,
              energy: 0,
              concerto: 0,
              toughness: 0,
              weakness: 0,
            },
          ],
        },
        {
          name: "Stage 2",
          value: "1",
          actionTime: 8,
          damage: [
            {
              type: "Basic Attack",
              dmgType: "Physical",
              scalingStat: "ATK",
              actionFrame: 0,
              value: 0.5,
              energy: 0,
              concerto: 0,
              toughness: 0,
              weakness: 0,
            },
            {
              type: "Basic Attack",
              dmgType: "Physical",
              scalingStat: "ATK",
              actionFrame: 0,
              value: 0.25,
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
    {
      id: 102,
      name: "Hidden Skill",
      type: "Normal Attack",
      hidden: true,
      stages: [{ name: "Hidden Stage", value: "1", actionTime: 0, damage: [] }],
      damage: [],
    },
    {
      id: 103,
      name: "Resonance Skill",
      type: "Resonance Skill",
      stages: [
        {
          name: "Stage With Hidden",
          value: "1",
          actionTime: 5,
          hidden: true,
          damage: [],
        },
        { name: "", value: "1", actionTime: 5, damage: [] },
        {
          name: "Visible",
          newName: "Override",
          value: "1",
          actionTime: 5,
          damage: [],
        },
      ],
      damage: [],
    },
  ],
}

const echo1: EnrichedEcho = {
  id: 9001,
  name: "Test Echo",
  cost: 4,
  element: "Fusion",
  set: "Test Set",
  buffs: [],
  skill: {
    cooldown: 20,
    description: "A test echo",
    stages: [
      {
        name: "Tap",
        newName: "Tap",
        actionTime: 30,
        damage: [
          {
            type: "Echo Skill",
            dmgType: "Damage",
            scalingStat: "ATK",
            actionFrame: 0,
            value: 2.5,
            energy: 0,
            concerto: 0,
            toughness: 0,
            weakness: 0,
          },
        ],
      },
      {
        name: "Hold",
        newName: "Hold",
        actionTime: 0,
        hidden: true,
        damage: [],
      },
    ],
  },
}

const echoParen: EnrichedEcho = {
  ...echo1,
  id: 9002,
  skill: {
    ...echo1.skill,
    stages: [{ ...echo1.skill.stages[0], newName: "(Tap)" }],
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

function setCatalog(characters: EnrichedCharacter[], echoes: EnrichedEcho[]) {
  testCharacters = characters
  testEchoes = echoes
}

const noLoadouts: SlotLoadout[] = [
  { weaponId: null, echoId: null, echoSetId: null },
  { weaponId: null, echoId: null, echoSetId: null },
  { weaponId: null, echoId: null, echoSetId: null },
]

describe("focused-stage-catalog — empty cases", () => {
  it("returns empty arrays when focusedId is null", () => {
    setCatalog([char1], [])
    const slots: Slots = [1, null, null]
    expect(getFocusedStageCatalog(slots, noLoadouts, null)).toEqual({
      echoStages: [],
      characterStages: [],
    })
  })

  it("returns empty arrays when focusedId is not in slots", () => {
    setCatalog([char1], [])
    const slots: Slots = [null, null, null]
    expect(getFocusedStageCatalog(slots, noLoadouts, 1)).toEqual({
      echoStages: [],
      characterStages: [],
    })
  })

  it("returns empty arrays when the focused character is not in the catalog", () => {
    setCatalog([], [])
    const slots: Slots = [1, null, null]
    expect(getFocusedStageCatalog(slots, noLoadouts, 1)).toEqual({
      echoStages: [],
      characterStages: [],
    })
  })
})

describe("focused-stage-catalog — character stages", () => {
  it("filters out hidden Skills entirely", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    const labels = result.characterStages.map((s) => s.label)
    expect(labels).not.toContain("Hidden Skill")
    expect(labels).not.toContain("Hidden Stage")
  })

  it("filters out hidden Stages within visible Skills", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    expect(
      result.characterStages.find((s) => s.label === "Stage With Hidden"),
    ).toBeUndefined()
  })

  it("filters out Stages with empty name", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    expect(result.characterStages.every((s) => s.label !== "")).toBe(true)
  })

  it("does not filter out Stages whose newName is the override label", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    expect(
      result.characterStages.find(
        (s) => s.label === "Resonance Skill · Override",
      ),
    ).toBeDefined()
  })

  it("derives attack type from the first damage entry when present", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    const stage1 = result.characterStages.find(
      (s) => s.label === "Normal Attack",
    )
    expect(stage1?.clickPayload.attackType).toBe("Basic Attack")
    expect(stage1?.typeLabel).toBe("BASIC")
  })

  it("falls back to skill type when stage has no damage entries", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    const stage = result.characterStages.find(
      (s) => s.label === "Resonance Skill · Override",
    )
    expect(stage?.clickPayload.attackType).toBe("Resonance Skill")
    expect(stage?.typeLabel).toBe("SKILL")
  })

  it("sums multipliers across damage entries", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    const stage2 = result.characterStages.find(
      (s) => s.clickPayload.actionTime === 8,
    )
    expect(stage2?.clickPayload.multiplier).toBeCloseTo(0.75)
  })

  it("click payload carries characterId, skillType, skillName, actionTime", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    const stage1 = result.characterStages[0]
    expect(stage1.clickPayload).toEqual({
      characterId: 1,
      skillType: "Normal Attack",
      skillName: "Normal Attack",
      attackType: "Basic Attack",
      actionTime: 12,
      multiplier: 1.5,
    })
  })
})

describe("focused-stage-catalog — labels", () => {
  it("uses skill name when stage has no newName", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    expect(result.characterStages[0].label).toBe("Normal Attack")
  })

  it("joins skill name and newName with a bullet for plain newName", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    expect(
      result.characterStages.find(
        (s) => s.label === "Resonance Skill · Override",
      ),
    ).toBeDefined()
  })

  it("joins skill name and newName with a space when newName starts with parenthesis", () => {
    setCatalog([char1], [echoParen])
    const loadouts: SlotLoadout[] = [
      { weaponId: null, echoId: 9002, echoSetId: null },
      { weaponId: null, echoId: null, echoSetId: null },
      { weaponId: null, echoId: null, echoSetId: null },
    ]
    const result = getFocusedStageCatalog([1, null, null], loadouts, 1)
    expect(result.echoStages[0].label).toBe("Test Echo (Tap)")
    expect(result.echoStages[0].clickPayload.skillName).toBe("Test Echo (Tap)")
  })
})

describe("focused-stage-catalog — echo stages", () => {
  const loadoutsWithEcho: SlotLoadout[] = [
    { weaponId: null, echoId: 9001, echoSetId: null },
    { weaponId: null, echoId: null, echoSetId: null },
    { weaponId: null, echoId: null, echoSetId: null },
  ]

  it("includes visible echo stages from the focused slot's echo", () => {
    setCatalog([char1], [echo1])
    const result = getFocusedStageCatalog([1, null, null], loadoutsWithEcho, 1)
    expect(result.echoStages.map((s) => s.label)).toEqual(["Test Echo · Tap"])
  })

  it("filters out echo stages with hidden: true", () => {
    setCatalog([char1], [echo1])
    const result = getFocusedStageCatalog([1, null, null], loadoutsWithEcho, 1)
    expect(
      result.echoStages.find((s) => s.label === "Test Echo · Hold"),
    ).toBeUndefined()
  })

  it("returns no echo stages when slot has no echo", () => {
    setCatalog([char1], [echo1])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    expect(result.echoStages).toEqual([])
  })

  it("echo stage click payload has skillType Echo Skill and attackType from damage", () => {
    setCatalog([char1], [echo1])
    const result = getFocusedStageCatalog([1, null, null], loadoutsWithEcho, 1)
    expect(result.echoStages[0].clickPayload).toEqual({
      characterId: 1,
      skillType: "Echo Skill",
      skillName: "Test Echo · Tap",
      attackType: "Echo Skill",
      actionTime: 30,
      multiplier: 2.5,
    })
  })

  it("uses the loadout for the focused slot, not slot index 0", () => {
    setCatalog([char1], [echo1])
    const slots: Slots = [null, 1, null]
    const loadouts: SlotLoadout[] = [
      { weaponId: null, echoId: null, echoSetId: null },
      { weaponId: null, echoId: 9001, echoSetId: null },
      { weaponId: null, echoId: null, echoSetId: null },
    ]
    const result = getFocusedStageCatalog(slots, loadouts, 1)
    expect(result.echoStages.length).toBe(1)
  })
})

describe("focused-stage-catalog — divider rule", () => {
  const loadoutsWithEcho: SlotLoadout[] = [
    { weaponId: null, echoId: 9001, echoSetId: null },
    { weaponId: null, echoId: null, echoSetId: null },
    { weaponId: null, echoId: null, echoSetId: null },
  ]

  it("returns both echo and character stages when both exist (consumer renders divider)", () => {
    setCatalog([char1], [echo1])
    const result = getFocusedStageCatalog([1, null, null], loadoutsWithEcho, 1)
    expect(result.echoStages.length).toBeGreaterThan(0)
    expect(result.characterStages.length).toBeGreaterThan(0)
  })

  it("returns no echo stages when echo is absent (consumer omits divider)", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    expect(result.echoStages.length).toBe(0)
    expect(result.characterStages.length).toBeGreaterThan(0)
  })
})
