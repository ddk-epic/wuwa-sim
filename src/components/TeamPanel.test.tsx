// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout } from "#/types/loadout"
import { TeamProvider } from "#/hooks/useTeamContext"
import type { TeamContextValue } from "#/hooks/useTeamContext"
import { TeamPanel } from "./TeamPanel"

vi.mock("#/lib/loadout/catalog", () => ({
  getCharacterById: (id: number) => (id === 1 ? testChar : null),
  listWeaponsByType: () => [],
  listEchoes: () => [],
  listEchoSets: () => [],
}))

const testChar: EnrichedCharacter = {
  id: 1,
  name: "Test",
  element: "Aero",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 0, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [],
}

afterEach(cleanup)

function makeLoadout(echoBuild: "4-3-3-1-1" | "4-4-1-1-1"): SlotLoadout {
  return {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
    echoBuild,
    cost4Mains: echoBuild === "4-3-3-1-1" ? ["cd"] : ["cr", "cd"],
    cost3Mains: echoBuild === "4-3-3-1-1" ? ["elemDmg", "elemDmg"] : [],
  }
}

const emptyLoadout = makeLoadout("4-3-3-1-1")

function renderWithTeam(loadout: SlotLoadout) {
  const value: TeamContextValue = {
    slots: [1, null, null],
    loadouts: [loadout, loadout, loadout],
    focusedId: 1,
    selectedCount: 1,
    toggleCharacter: vi.fn(),
    focusCharacter: vi.fn(),
    setSlotPatch: vi.fn(),
  }
  return render(
    <TeamProvider value={value}>
      <TeamPanel />
    </TeamProvider>,
  )
}

describe("TeamPanel — cost-3 row visibility", () => {
  it("shows Ele DMG option for 4-3-3-1-1 build", () => {
    renderWithTeam(emptyLoadout)
    expect(screen.queryByText("Ele DMG")).not.toBeNull()
  })

  it("hides cost-3 row for 4-4-1-1-1 build", () => {
    renderWithTeam(makeLoadout("4-4-1-1-1"))
    expect(screen.queryByText("Ele DMG")).toBeNull()
    expect(screen.queryByText("ER")).toBeNull()
  })
})
