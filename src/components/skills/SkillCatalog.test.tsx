// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { ReactElement } from "react"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { Slots, SlotLoadout } from "#/types/loadout"
import { TeamProvider } from "#/hooks/useTeamContext"

import { SkillCatalog } from "./SkillCatalog"

function renderWithTeam(
  ui: ReactElement,
  {
    slots,
    loadouts,
    focusedId,
    onFocus,
  }: {
    slots: Slots
    loadouts: SlotLoadout[]
    focusedId: number | null
    onFocus?: (id: number) => void
  },
) {
  const value = {
    slots,
    loadouts: [loadouts[0], loadouts[1], loadouts[2]] as [
      SlotLoadout,
      SlotLoadout,
      SlotLoadout,
    ],
    focusedId,
    selectedCount: slots.filter((s) => s !== null).length,
    toggleCharacter: vi.fn(),
    focusCharacter: onFocus ?? vi.fn(),
    setSlotPatch: vi.fn(),
  }
  return render(<TeamProvider value={value}>{ui}</TeamProvider>)
}

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
    ],
  },
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

let testCharacters: EnrichedCharacter[] = []
let testEchoes: EnrichedEcho[] = []

vi.mock("#/lib/loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getEchoById: (id: number) => testEchoes.find((e) => e.id === id) ?? null,
}))

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
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: slots,
      loadouts: noLoadouts,
      focusedId: 1,
      onFocus: vi.fn(),
    })
    expect(screen.getByText("Encore")).toBeTruthy()
    expect(screen.getByText("Sanhua")).toBeTruthy()
  })

  it("clicking an unfocused tab calls onFocus with that character id", () => {
    setCatalog([char1, char2], [])
    const slots: Slots = [1, 2, null]
    const onFocus = vi.fn()
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: slots,
      loadouts: noLoadouts,
      focusedId: 1,
      onFocus: onFocus,
    })
    fireEvent.click(screen.getByRole("button", { name: /Sanhua/ }))
    expect(onFocus).toHaveBeenCalledWith(2)
  })
})

describe("SkillSidebar — stage rendering", () => {
  it("renders the focused character's stages with their resolved labels", () => {
    setCatalog([char1, char2], [])
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: [1, 2, null],
      loadouts: noLoadouts,
      focusedId: 1,
      onFocus: vi.fn(),
    })
    expect(screen.getByText("Normal Attack")).toBeTruthy()
    expect(screen.getAllByText("BASIC").length).toBeGreaterThan(0)
  })

  it("clicking a stage row calls onStageClick with the stage's click payload", () => {
    setCatalog([char1], [])
    const onStageClick = vi.fn()
    renderWithTeam(<SkillCatalog onStageClick={onStageClick} />, {
      slots: [1, null, null],
      loadouts: noLoadouts,
      focusedId: 1,
      onFocus: vi.fn(),
    })
    fireEvent.click(screen.getByText("Normal Attack"))
    expect(onStageClick).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: 1,
        stageId: "char.encore.basic-attack.normal-attack._",
      }),
    )
  })

  it("shows duration for each stage row in seconds 2dp", () => {
    setCatalog([char1], [testEcho])
    const loadoutsWithEcho: SlotLoadout[] = [
      { ...noLoadouts[0], echoId: 9001 },
      ...noLoadouts.slice(1),
    ]
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: [1, null, null],
      loadouts: loadoutsWithEcho,
      focusedId: 1,
      onFocus: vi.fn(),
    })
    // testEcho stage has actionTime 30 → 30/60 = 0.50s
    expect(screen.getByText("0.50s")).toBeTruthy()
    // char1 stage has actionTime 0 → 0.00s
    expect(screen.getByText("0.00s")).toBeTruthy()
  })
})

describe("SkillSidebar — divider presence", () => {
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

  it("renders the divider when both echo and character stages exist", () => {
    setCatalog([char1], [testEcho])
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: [1, null, null],
      loadouts: loadoutsWithEcho,
      focusedId: 1,
      onFocus: vi.fn(),
    })
    expect(screen.getByTestId("echo-character-divider")).toBeTruthy()
  })

  it("omits the divider when there are no echo stages", () => {
    setCatalog([char1], [])
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: [1, null, null],
      loadouts: noLoadouts,
      focusedId: 1,
      onFocus: vi.fn(),
    })
    expect(screen.queryByTestId("echo-character-divider")).toBeNull()
  })
})

const charWithIntroOutro: EnrichedCharacter = {
  ...char1,
  id: 3,
  name: "TestHero",
  skills: [
    {
      id: 301,
      name: "Intro Skill",
      type: "Intro Skill",
      stages: [{ name: "Intro", value: "1", actionTime: 10, damage: [] }],
      damage: [],
    },
    {
      id: 302,
      name: "Outro Skill",
      type: "Outro Skill",
      stages: [{ name: "Outro", value: "1", actionTime: 15, damage: [] }],
      damage: [],
    },
    {
      id: 303,
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
              value: 1,
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

describe("SkillSidebar — filter chips", () => {
  it("renders filter chips including 'all' and 'BASIC' but no separate INTRO or OUTRO chips", () => {
    setCatalog([char1], [])
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: [1, null, null],
      loadouts: noLoadouts,
      focusedId: 1,
      onFocus: vi.fn(),
    })
    expect(screen.getByRole("button", { name: "all" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "BASIC" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "IN/OUT" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "INTRO" })).toBeNull()
    expect(screen.queryByRole("button", { name: "OUTRO" })).toBeNull()
  })

  it("filtering to ECHO hides non-echo stages", () => {
    setCatalog([char1], [testEcho])
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: [1, null, null],
      loadouts: [{ ...noLoadouts[0], echoId: 9001 }, ...noLoadouts.slice(1)],
      focusedId: 1,
      onFocus: vi.fn(),
    })
    fireEvent.click(screen.getByRole("button", { name: "ECHO" }))
    expect(screen.queryByText("Normal Attack")).toBeNull()
    expect(screen.getByText(/Test Echo/)).toBeTruthy()
  })

  it("clicking 'all' after a specific filter restores all stages", () => {
    setCatalog([char1], [testEcho])
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: [1, null, null],
      loadouts: [{ ...noLoadouts[0], echoId: 9001 }, ...noLoadouts.slice(1)],
      focusedId: 1,
      onFocus: vi.fn(),
    })
    fireEvent.click(screen.getByRole("button", { name: "ECHO" }))
    fireEvent.click(screen.getByRole("button", { name: "all" }))
    expect(screen.getByText("Normal Attack")).toBeTruthy()
    expect(screen.getByText(/Test Echo/)).toBeTruthy()
  })

  it("clicking the active filter chip deselects it and re-highlights 'all'", () => {
    setCatalog([char1], [testEcho])
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: [1, null, null],
      loadouts: [{ ...noLoadouts[0], echoId: 9001 }, ...noLoadouts.slice(1)],
      focusedId: 1,
      onFocus: vi.fn(),
    })
    fireEvent.click(screen.getByRole("button", { name: "ECHO" }))
    expect(screen.queryByText("Normal Attack")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "ECHO" }))
    expect(screen.getByText("Normal Attack")).toBeTruthy()
  })

  it("IN/OUT chip shows both Intro Skill and Outro Skill stages, hides others", () => {
    setCatalog([charWithIntroOutro], [])
    renderWithTeam(<SkillCatalog onStageClick={vi.fn()} />, {
      slots: [3, null, null],
      loadouts: noLoadouts,
      focusedId: 3,
      onFocus: vi.fn(),
    })
    fireEvent.click(screen.getByRole("button", { name: "IN/OUT" }))
    expect(screen.getByText("Intro Skill")).toBeTruthy()
    expect(screen.getByText("Outro Skill")).toBeTruthy()
    expect(screen.queryByText("Normal Attack")).toBeNull()
  })
})
