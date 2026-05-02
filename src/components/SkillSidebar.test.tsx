// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"

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
          actionTime: 0,
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
      ],
      damage: [],
    },
  ],
}

const char2: EnrichedCharacter = {
  id: 2,
  name: "Sanhua",
  element: "Glacio",
  weaponType: "Sword",
  rarity: "4",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 0, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 201,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [{ name: "Stage 1", value: "1", actionTime: 0, damage: [] }],
      damage: [],
    },
  ],
}

const testEcho: EnrichedEcho = {
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
    ],
  },
}

const noLoadouts: SlotLoadout[] = [
  { weaponId: null, echoId: null, echoSetId: null },
  { weaponId: null, echoId: null, echoSetId: null },
  { weaponId: null, echoId: null, echoSetId: null },
]

let testCharacters: EnrichedCharacter[] = []
let testEchoes: EnrichedEcho[] = []

vi.mock("#/lib/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getEchoById: (id: number) => testEchoes.find((e) => e.id === id) ?? null,
}))

import { SkillSidebar } from "./SkillSidebar"

afterEach(() => {
  cleanup()
  testCharacters = []
  testEchoes = []
})

function setCatalog(characters: EnrichedCharacter[], echoes: EnrichedEcho[]) {
  testCharacters = characters
  testEchoes = echoes
}

describe("SkillSidebar — tab strip", () => {
  it("renders one tab per filled slot", () => {
    setCatalog([char1, char2], [])
    const slots: Slots = [1, 2, null]
    render(
      <SkillSidebar
        slots={slots}
        loadouts={noLoadouts}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText("Encore")).toBeTruthy()
    expect(screen.getByText("Sanhua")).toBeTruthy()
  })

  it("clicking an unfocused tab calls onFocus with that character id", () => {
    setCatalog([char1, char2], [])
    const slots: Slots = [1, 2, null]
    const onFocus = vi.fn()
    render(
      <SkillSidebar
        slots={slots}
        loadouts={noLoadouts}
        focusedId={1}
        onFocus={onFocus}
        onStageClick={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Sanhua/ }))
    expect(onFocus).toHaveBeenCalledWith(2)
  })
})

describe("SkillSidebar — stage rendering", () => {
  it("renders the focused character's stages with their resolved labels", () => {
    setCatalog([char1, char2], [])
    render(
      <SkillSidebar
        slots={[1, 2, null]}
        loadouts={noLoadouts}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText("Normal Attack")).toBeTruthy()
    expect(screen.getByText("BASIC")).toBeTruthy()
  })

  it("clicking a stage row calls onStageClick with the stage's click payload", () => {
    setCatalog([char1], [])
    const onStageClick = vi.fn()
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={noLoadouts}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={onStageClick}
      />,
    )
    fireEvent.click(screen.getByText("Normal Attack"))
    expect(onStageClick).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: 1,
        attackType: "Basic Attack",
        skillName: "Normal Attack",
        multiplier: 1.5,
      }),
    )
  })
})

describe("SkillSidebar — divider presence", () => {
  const loadoutsWithEcho: SlotLoadout[] = [
    { weaponId: null, echoId: 9001, echoSetId: null },
    { weaponId: null, echoId: null, echoSetId: null },
    { weaponId: null, echoId: null, echoSetId: null },
  ]

  it("renders the divider when both echo and character stages exist", () => {
    setCatalog([char1], [testEcho])
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={loadoutsWithEcho}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByTestId("echo-character-divider")).toBeTruthy()
  })

  it("omits the divider when there are no echo stages", () => {
    setCatalog([char1], [])
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={noLoadouts}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.queryByTestId("echo-character-divider")).toBeNull()
  })
})
