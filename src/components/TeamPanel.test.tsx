// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout } from "#/types/loadout"
import { TeamPanel } from "./TeamPanel"

vi.mock("#/lib/catalog", () => ({
  getCharacterById: (id: number) => (id === 1 ? testChar : null),
  listWeaponsByType: () => [],
  listEchoes: () => [],
  listEchoSets: () => [],
}))

let testChar: EnrichedCharacter = {
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

describe("TeamPanel — cost-3 row visibility", () => {
  it("shows Elem DMG option for 4-3-3-1-1 build", () => {
    render(
      <TeamPanel
        slots={[1, null, null]}
        loadouts={[emptyLoadout, emptyLoadout, emptyLoadout]}
        onSlotChange={vi.fn()}
      />,
    )
    expect(screen.queryByText("Elem DMG")).not.toBeNull()
  })

  it("hides cost-3 row for 4-4-1-1-1 build", () => {
    const loadout441 = makeLoadout("4-4-1-1-1")
    render(
      <TeamPanel
        slots={[1, null, null]}
        loadouts={[loadout441, loadout441, loadout441]}
        onSlotChange={vi.fn()}
      />,
    )
    expect(screen.queryByText("Elem DMG")).toBeNull()
    expect(screen.queryByText("ER")).toBeNull()
  })
})
