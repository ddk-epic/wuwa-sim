// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { SkillSidebar } from "./SkillSidebar"
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
    {
      id: 102,
      name: "Hidden Skill",
      type: "Normal Attack",
      hidden: true,
      stages: [{ name: "Hidden Stage", value: "1", actionTime: 0, damage: [] }],
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

const noLoadouts: SlotLoadout[] = [
  { weaponId: null, echoId: null, echoSetId: null },
  { weaponId: null, echoId: null, echoSetId: null },
  { weaponId: null, echoId: null, echoSetId: null },
]

const characters = [char1, char2]
const echoes = [testEcho]

afterEach(cleanup)

describe("SkillSidebar — tab strip", () => {
  it("renders one tab per filled slot", () => {
    const slots: Slots = [1, 2, null]
    render(
      <SkillSidebar
        slots={slots}
        loadouts={noLoadouts}
        echoes={[]}
        characters={characters}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText("Encore")).toBeTruthy()
    expect(screen.getByText("Sanhua")).toBeTruthy()
  })

  it("shows skills for the focused character", () => {
    const slots: Slots = [1, 2, null]
    render(
      <SkillSidebar
        slots={slots}
        loadouts={noLoadouts}
        echoes={[]}
        characters={characters}
        focusedId={2}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getAllByText("Normal Attack").length).toBeGreaterThan(0)
  })

  it("clicking an unfocused tab calls onFocus with that character id", () => {
    const slots: Slots = [1, 2, null]
    const onFocus = vi.fn()
    render(
      <SkillSidebar
        slots={slots}
        loadouts={noLoadouts}
        echoes={[]}
        characters={characters}
        focusedId={1}
        onFocus={onFocus}
        onStageClick={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Sanhua/ }))
    expect(onFocus).toHaveBeenCalledWith(2)
  })

  it("does not display rarity anywhere", () => {
    const slots: Slots = [1, null, null]
    const { container } = render(
      <SkillSidebar
        slots={slots}
        loadouts={noLoadouts}
        echoes={[]}
        characters={characters}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(container.textContent).not.toContain("rarity")
    expect(container.textContent).not.toContain(char1.rarity)
  })

  it("falls back to name when newName is empty string", () => {
    const charWithEmptyNewName: EnrichedCharacter = {
      ...char1,
      skills: [
        {
          ...char1.skills[0],
          stages: [{ ...char1.skills[0].stages[0], newName: "" }],
        },
      ],
    }
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={noLoadouts}
        echoes={[]}
        characters={[charWithEmptyNewName]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText("Normal Attack")).toBeTruthy()
  })

  it("renders newName instead of name when set on a stage", () => {
    const charWithNewName: EnrichedCharacter = {
      ...char1,
      skills: [
        {
          ...char1.skills[0],
          stages: [{ ...char1.skills[0].stages[0], newName: "Override Label" }],
        },
      ],
    }
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={noLoadouts}
        echoes={[]}
        characters={[charWithNewName]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText("Normal Attack · Override Label")).toBeTruthy()
    expect(screen.queryByText("Stage 1")).toBeNull()
  })

  it("hides skills with hidden: true", () => {
    const slots: Slots = [1, null, null]
    render(
      <SkillSidebar
        slots={slots}
        loadouts={noLoadouts}
        echoes={[]}
        characters={characters}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.queryByText("Hidden Stage")).toBeNull()
    expect(screen.queryByText("Hidden Skill")).toBeNull()
  })
})

describe("SkillSidebar — attack type labels", () => {
  it("shows BASIC label for a stage with Basic Attack damage type", () => {
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={noLoadouts}
        echoes={[]}
        characters={[char1]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText("BASIC")).toBeTruthy()
  })

  it("shows no abbreviation label when attack type is unknown", () => {
    const charUnknown: EnrichedCharacter = {
      ...char2,
      skills: [
        {
          ...char2.skills[0],
          type: "Normal Attack",
          stages: [{ name: "Stage 1", value: "1", actionTime: 0, damage: [] }],
        },
      ],
    }
    const { container } = render(
      <SkillSidebar
        slots={[2, null, null]}
        loadouts={noLoadouts}
        echoes={[]}
        characters={[charUnknown]}
        focusedId={2}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    for (const label of [
      "BASIC",
      "HEAVY",
      "SKILL",
      "LIBER",
      "FORTE",
      "INTRO",
      "OUTRO",
    ]) {
      expect(container.textContent).not.toContain(label)
    }
  })

  it("shows SKILL label when skill type is Resonance Skill and no damage entries", () => {
    const charSkill: EnrichedCharacter = {
      ...char2,
      skills: [
        {
          ...char2.skills[0],
          type: "Resonance Skill",
          stages: [{ name: "Stage 1", value: "1", actionTime: 0, damage: [] }],
        },
      ],
    }
    render(
      <SkillSidebar
        slots={[2, null, null]}
        loadouts={noLoadouts}
        echoes={[]}
        characters={[charSkill]}
        focusedId={2}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText("SKILL")).toBeTruthy()
  })
})

describe("SkillSidebar — outro stages", () => {
  const charWithOutro: EnrichedCharacter = {
    ...char2,
    id: 3,
    name: "OutroChar",
    skills: [
      {
        id: 301,
        name: "Silversnow",
        type: "Outro Skill",
        stages: [
          {
            name: "Outro DMG",
            newName: "",
            value: "0%",
            actionTime: 0,
            damage: [],
          },
        ],
        damage: [],
      },
    ],
  }

  it("renders the outro stage row with OUTRO label", () => {
    render(
      <SkillSidebar
        slots={[3, null, null]}
        loadouts={noLoadouts}
        echoes={[]}
        characters={[charWithOutro]}
        focusedId={3}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText("OUTRO")).toBeTruthy()
    expect(screen.getByText("Silversnow")).toBeTruthy()
  })

  it("clicking outro stage calls onStageClick with attackType Outro Skill", () => {
    const onStageClick = vi.fn()
    render(
      <SkillSidebar
        slots={[3, null, null]}
        loadouts={noLoadouts}
        echoes={[]}
        characters={[charWithOutro]}
        focusedId={3}
        onFocus={vi.fn()}
        onStageClick={onStageClick}
      />,
    )
    fireEvent.click(screen.getByText("Silversnow"))
    expect(onStageClick).toHaveBeenCalledWith(
      expect.objectContaining({
        attackType: "Outro Skill",
        multiplier: 0,
        actionTime: 0,
        characterId: 3,
      }),
    )
  })
})

describe("SkillSidebar — echo stages", () => {
  const loadoutsWithEcho: SlotLoadout[] = [
    { weaponId: null, echoId: 9001, echoSetId: null },
    { weaponId: null, echoId: null, echoSetId: null },
    { weaponId: null, echoId: null, echoSetId: null },
  ]

  it("renders visible echo stages above character stages", () => {
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={loadoutsWithEcho}
        echoes={echoes}
        characters={[char1]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText("Test Echo · Tap")).toBeTruthy()
  })

  it("does not render echo stages with hidden: true", () => {
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={loadoutsWithEcho}
        echoes={echoes}
        characters={[char1]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.queryByText("Test Echo · Hold")).toBeNull()
  })

  it("renders no echo stages when slot has no echo", () => {
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={noLoadouts}
        echoes={echoes}
        characters={[char1]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.queryByText(/Test Echo/)).toBeNull()
  })

  it("clicking echo stage calls onStageClick with Echo Skill attackType", () => {
    const onStageClick = vi.fn()
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={loadoutsWithEcho}
        echoes={echoes}
        characters={[char1]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={onStageClick}
      />,
    )
    fireEvent.click(screen.getByText("Test Echo · Tap"))
    expect(onStageClick).toHaveBeenCalledWith(
      expect.objectContaining({
        attackType: "Echo Skill",
        multiplier: 2.5,
        actionTime: 30,
        characterId: 1,
      }),
    )
  })

  it("renders parenthesised newName with space separator (no bullet)", () => {
    const echoParenName: EnrichedEcho = {
      ...testEcho,
      id: 9002,
      skill: {
        ...testEcho.skill,
        stages: [{ ...testEcho.skill.stages[0], newName: "(Tap)" }],
      },
    }
    const loadoutsWithParen: SlotLoadout[] = [
      { weaponId: null, echoId: 9002, echoSetId: null },
      { weaponId: null, echoId: null, echoSetId: null },
      { weaponId: null, echoId: null, echoSetId: null },
    ]
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={loadoutsWithParen}
        echoes={[echoParenName]}
        characters={[char1]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={vi.fn()}
      />,
    )
    expect(screen.getByText("Test Echo (Tap)")).toBeTruthy()
    expect(screen.queryByText("Test Echo · (Tap)")).toBeNull()
  })

  it("passes space-separated skillName to onStageClick for parenthesised newName", () => {
    const echoParenName: EnrichedEcho = {
      ...testEcho,
      id: 9002,
      skill: {
        ...testEcho.skill,
        stages: [{ ...testEcho.skill.stages[0], newName: "(Tap)" }],
      },
    }
    const loadoutsWithParen: SlotLoadout[] = [
      { weaponId: null, echoId: 9002, echoSetId: null },
      { weaponId: null, echoId: null, echoSetId: null },
      { weaponId: null, echoId: null, echoSetId: null },
    ]
    const onStageClick = vi.fn()
    render(
      <SkillSidebar
        slots={[1, null, null]}
        loadouts={loadoutsWithParen}
        echoes={[echoParenName]}
        characters={[char1]}
        focusedId={1}
        onFocus={vi.fn()}
        onStageClick={onStageClick}
      />,
    )
    fireEvent.click(screen.getByText("Test Echo (Tap)"))
    expect(onStageClick).toHaveBeenCalledWith(
      expect.objectContaining({ skillName: "Test Echo (Tap)" }),
    )
  })
})
