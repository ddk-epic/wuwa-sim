import { describe, expect, it, vi } from "vitest"
import type { SlotLoadout } from "#/types/loadout"
import type { SavedTeam } from "#/hooks/useLibrary"
import type { ImportExportPayload } from "#/lib/import-export"

vi.mock("#/lib/loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    ({
      1102: { id: 1102, name: "Sanhua", element: "Glacio" },
      1203: { id: 1203, name: "Encore", element: "Fusion" },
    })[id] ?? null,
  getWeaponById: (id: number) =>
    ({ 21020015: { id: 21020015, name: "Emerald of Genesis" } })[id] ?? null,
}))

const { savedTeamToLibTeam } = await import("./savedTeamToLibTeam")

function loadout(over: Partial<SlotLoadout> = {}): SlotLoadout {
  return {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
    echoBuild: "4-3-3-1-1",
    cost4Mains: ["cd"],
    cost3Mains: ["elemDmg", "elemDmg"],
    ...over,
  }
}

function savedTeam(over: Partial<SavedTeam> = {}): SavedTeam {
  const payload: ImportExportPayload = {
    team: {
      name: "Frosty",
      slots: [1102, 1203, null],
      loadouts: [
        loadout({ weaponId: 21020015, sequence: 2 }),
        loadout({ sequence: 0 }),
        loadout(),
      ],
      focusedId: 1102,
    },
    timeline: null,
  }
  return {
    id: "team-abc",
    name: "Frosty",
    updated: Date.UTC(2026, 5, 2),
    pinned: true,
    payload,
    stats: {
      dmgByChar: { 1102: 8000, 1203: 2000 },
      typeMix: {
        "Basic Attack": { count: 3, dmg: 5000 },
        "Resonance Skill": { count: 1, dmg: 5000 },
      },
      concertoEnd: 80,
      resEnd: 120,
    },
    ...over,
  }
}

describe("savedTeamToLibTeam", () => {
  it("passes identity fields through", () => {
    const lib = savedTeamToLibTeam(savedTeam())
    expect(lib.id).toBe("team-abc")
    expect(lib.name).toBe("Frosty")
    expect(lib.pinned).toBe(true)
    expect(lib.updated).toBe("2026-06-02")
  })

  it("resolves filled slots into members (name/element/weapon/seq), skipping nulls and omitting role", () => {
    const lib = savedTeamToLibTeam(savedTeam())
    expect(lib.members).toEqual([
      {
        name: "Sanhua",
        element: "Glacio",
        seq: 2,
        weapon: "Emerald of Genesis",
      },
      { name: "Encore", element: "Fusion", seq: 0, weapon: "" },
    ])
    // role is not a field on Member
    expect(lib.members[0]).not.toHaveProperty("role")
  })

  it("re-keys dmgByChar from characterId to member name and passes typeMix through", () => {
    const lib = savedTeamToLibTeam(savedTeam())
    expect(lib.dmgByChar).toEqual({ Sanhua: 8000, Encore: 2000 })
    expect(lib.typeMix).toEqual({
      "Basic Attack": { count: 3, dmg: 5000 },
      "Resonance Skill": { count: 1, dmg: 5000 },
    })
  })

  it("derives totalDmg as the sum of per-character damage and projects resource ends", () => {
    const lib = savedTeamToLibTeam(savedTeam())
    expect(lib.totalDmg).toBe(10000)
    expect(lib.concertoEnd).toBe(80)
    expect(lib.resEnd).toBe(120)
  })

  it("reports actions/time/dps as zero when there is no timeline", () => {
    const lib = savedTeamToLibTeam(savedTeam())
    expect(lib.actions).toBe(0)
    expect(lib.totalTime).toBe(0)
    expect(lib.dps).toBe(0)
  })
})
