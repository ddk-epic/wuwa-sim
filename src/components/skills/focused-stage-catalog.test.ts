// @vitest-environment node
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
  maxEnergy: 100,
  forteCap: 100,
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
          category: "Basic Attack",
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
          category: "Basic Attack",
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
      stages: [
        {
          name: "Hidden Stage",
          category: "Basic Attack",
          value: "1",
          actionTime: 0,
          damage: [],
        },
      ],
      damage: [],
    },
    {
      id: 103,
      name: "Resonance Skill",
      type: "Resonance Skill",
      stages: [
        {
          name: "Stage With Hidden",
          category: "Basic Attack",
          value: "1",
          actionTime: 5,
          hidden: true,
          damage: [],
        },
        {
          name: "",
          category: "Basic Attack",
          value: "1",
          actionTime: 5,
          damage: [],
        },
        {
          name: "Visible",
          category: "Resonance Skill",
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
  sets: ["Test Set"],
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

vi.mock("../../lib/loadout/catalog", () => ({
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

  it("character stage click payload carries characterId and stageId", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    const stage = result.characterStages.find(
      (s) => s.label === "Normal Attack",
    )
    expect(stage?.clickPayload).toEqual({
      characterId: 1,
      stageId: "char.encore.basic-attack.normal-attack.stage-1::basic-attack",
    })
  })

  it("typeLabel reflects the stage's skillCategory", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    const basic = result.characterStages.find(
      (s) => s.label === "Normal Attack",
    )
    expect(basic?.typeLabel).toBe("BASIC")
    const skill = result.characterStages.find(
      (s) => s.label === "Resonance Skill · Override",
    )
    expect(skill?.typeLabel).toBe("SKILL")
  })

  it("derives skillType from the first damage entry, falling back to category", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    const withDamage = result.characterStages.find(
      (s) => s.label === "Normal Attack",
    )
    expect(withDamage?.skillType).toBe("Basic Attack")
    const noDamage = result.characterStages.find(
      (s) => s.label === "Resonance Skill · Override",
    )
    expect(noDamage?.skillType).toBe("Resonance Skill")
  })

  it("exposes skillGrouping from the parent Skill and skillCategory from the stage", () => {
    setCatalog([char1], [])
    const result = getFocusedStageCatalog([1, null, null], noLoadouts, 1)
    const stage1 = result.characterStages.find(
      (s) => s.label === "Normal Attack",
    )
    expect(stage1?.skillGrouping).toBe("Normal Attack")
    expect(stage1?.skillCategory).toBe("Basic Attack")

    const override = result.characterStages.find(
      (s) => s.label === "Resonance Skill · Override",
    )
    expect(override?.skillGrouping).toBe("Resonance Skill")
    expect(override?.skillCategory).toBe("Resonance Skill")
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
      {
        weaponId: null,
        weaponRank: 1,
        echoId: 9002,
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
    const result = getFocusedStageCatalog([1, null, null], loadouts, 1)
    expect(result.echoStages[0].label).toBe("Test Echo (Tap)")
    expect(result.echoStages[0].clickPayload.stageId).toBe(
      "echo.test-echo.tap::echo-skill",
    )
  })
})

describe("focused-stage-catalog — echo stages", () => {
  const loadoutsWithEcho: SlotLoadout[] = [
    {
      weaponId: null,
      weaponRank: 1,
      echoId: 9001,
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

  it("echo stage click payload carries characterId and stageId", () => {
    setCatalog([char1], [echo1])
    const result = getFocusedStageCatalog([1, null, null], loadoutsWithEcho, 1)
    expect(result.echoStages[0].clickPayload).toEqual({
      characterId: 1,
      stageId: "echo.test-echo.tap::echo-skill",
    })
  })

  it("uses the loadout for the focused slot, not slot index 0", () => {
    setCatalog([char1], [echo1])
    const slots: Slots = [null, 1, null]
    const loadouts: SlotLoadout[] = [
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
        echoId: 9001,
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
    const result = getFocusedStageCatalog(slots, loadouts, 1)
    expect(result.echoStages.length).toBe(1)
  })
})

describe("focused-stage-catalog — sequence gating", () => {
  const gatedChar: EnrichedCharacter = {
    ...char1,
    id: 3,
    skills: [
      {
        id: 301,
        name: "S6 Skill",
        type: "Resonance Skill",
        stages: [
          {
            name: "Gated",
            category: "Resonance Skill",
            value: "1",
            actionTime: 5,
            requiresSequence: 6,
            damage: [],
          },
        ],
        damage: [],
      },
    ],
  }

  function seqLoadouts(sequence: number): SlotLoadout[] {
    return noLoadouts.map((l) => ({ ...l, sequence }))
  }

  it("hides a sequence-gated stage below its gate", () => {
    setCatalog([gatedChar], [])
    const result = getFocusedStageCatalog([3, null, null], seqLoadouts(5), 3)
    expect(
      result.characterStages.find((s) => s.label === "S6 Skill"),
    ).toBeUndefined()
  })

  it("shows a sequence-gated stage at its gate", () => {
    setCatalog([gatedChar], [])
    const result = getFocusedStageCatalog([3, null, null], seqLoadouts(6), 3)
    expect(
      result.characterStages.find((s) => s.label === "S6 Skill"),
    ).toBeDefined()
  })
})
