// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { SlotLoadout } from "#/types/loadout"
import { encodePayload } from "#/lib/import-export"
import type { ImportExportPayload } from "#/lib/import-export"
import { useLibrary } from "./useLibrary"

beforeEach(() => {
  localStorage.clear()
})

function emptyLoadout(): SlotLoadout {
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
  }
}

/** An all-null/default payload that the real codec round-trips with no catalog data. */
function emptyPayload(): ImportExportPayload {
  return {
    team: {
      slots: [null, null, null],
      loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
      focusedId: null,
    },
    timeline: null,
  }
}

/** Seed the live `wuwa.*` keys that `saveCurrent` snapshots. */
function seedLive(opts: {
  slots?: unknown
  loadouts?: unknown
  focusedId?: unknown
  timeline?: unknown
  log?: unknown
}) {
  if (opts.slots !== undefined)
    localStorage.setItem("wuwa.team.slots", JSON.stringify(opts.slots))
  if (opts.loadouts !== undefined)
    localStorage.setItem("wuwa.team.loadouts", JSON.stringify(opts.loadouts))
  if (opts.focusedId !== undefined)
    localStorage.setItem("wuwa.team.focusedId", JSON.stringify(opts.focusedId))
  if (opts.timeline !== undefined)
    localStorage.setItem("wuwa.timeline.entries", JSON.stringify(opts.timeline))
  if (opts.log !== undefined)
    localStorage.setItem("wuwa.simulation-log", JSON.stringify(opts.log))
}

const aHit = (characterId: number, skillType: string, damage: number) => ({
  kind: "hit",
  characterId,
  skillType,
  damage,
  cumulativeEnergy: 30,
  cumulativeConcerto: 12,
})

describe("useLibrary", () => {
  it("starts empty when storage is empty", () => {
    const { result } = renderHook(() => useLibrary())
    expect(result.current.teams).toEqual([])
  })

  it("hydrates teams from wuwa.library on mount", () => {
    localStorage.setItem(
      "wuwa.library",
      JSON.stringify([
        {
          id: "x",
          name: "Stored",
          updated: 1,
          pinned: false,
          payload: emptyPayload(),
          stats: { dmgByChar: {}, typeMix: {}, concertoEnd: 0, resEnd: 0 },
        },
      ]),
    )
    const { result } = renderHook(() => useLibrary())
    expect(result.current.teams.map((t) => t.name)).toEqual(["Stored"])
  })

  it("saveCurrent snapshots the live keys into a new SavedTeam with computed stats", () => {
    seedLive({
      slots: [1102, null, null],
      loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
      focusedId: 1102,
      timeline: [{ kind: "entry", id: "e1", characterId: 1102, stageId: "s" }],
      log: [aHit(1102, "Basic Attack", 500), aHit(1102, "Heavy Attack", 300)],
    })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent("My Team"))

    expect(result.current.teams).toHaveLength(1)
    const team = result.current.teams[0]
    expect(team.name).toBe("My Team")
    expect(team.pinned).toBe(false)
    expect(team.id).toBeTruthy()
    expect(team.payload.team.slots).toEqual([1102, null, null])
    expect(team.payload.timeline).toHaveLength(1)
    expect(team.stats.dmgByChar).toEqual({ 1102: 800 })
    expect(team.stats.resEnd).toBe(30)
    // Persisted to wuwa.library
    expect(JSON.parse(localStorage.getItem("wuwa.library")!)).toHaveLength(1)
  })

  it("saveCurrent always creates a new entry (never updates in place)", () => {
    seedLive({ slots: [null, null, null] })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent("A"))
    act(() => result.current.saveCurrent("A"))
    expect(result.current.teams).toHaveLength(2)
    expect(result.current.teams[0].id).not.toBe(result.current.teams[1].id)
  })

  it("rename changes a team's name", () => {
    seedLive({ slots: [null, null, null] })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent("Old"))
    const id = result.current.teams[0].id
    act(() => result.current.rename(id, "New"))
    expect(result.current.teams[0].name).toBe("New")
  })

  it("togglePin flips the pinned flag", () => {
    seedLive({ slots: [null, null, null] })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent("T"))
    const id = result.current.teams[0].id
    act(() => result.current.togglePin(id))
    expect(result.current.teams[0].pinned).toBe(true)
    act(() => result.current.togglePin(id))
    expect(result.current.teams[0].pinned).toBe(false)
  })

  it("duplicate appends a detached copy with a new id", () => {
    seedLive({ slots: [null, null, null] })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent("Base"))
    const id = result.current.teams[0].id
    act(() => result.current.duplicate(id))
    expect(result.current.teams).toHaveLength(2)
    expect(result.current.teams[1].id).not.toBe(id)
  })

  it("remove deletes a team by id", () => {
    seedLive({ slots: [null, null, null] })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent("Gone"))
    const id = result.current.teams[0].id
    act(() => result.current.remove(id))
    expect(result.current.teams).toEqual([])
  })

  it("importBundle parses a valid code into a new team and returns true", () => {
    const code = encodePayload(emptyPayload())
    const { result } = renderHook(() => useLibrary())
    let ok = false
    act(() => {
      ok = result.current.importBundle(code)
    })
    expect(ok).toBe(true)
    expect(result.current.teams).toHaveLength(1)
  })

  it("importBundle rejects invalid input gracefully (returns false, adds nothing)", () => {
    const { result } = renderHook(() => useLibrary())
    let ok = true
    act(() => {
      ok = result.current.importBundle("@@@not-a-valid-bundle@@@")
    })
    expect(ok).toBe(false)
    expect(result.current.teams).toEqual([])
  })

  it("load writes the saved payload into the live keys and clears the log", () => {
    seedLive({
      slots: [1102, null, null],
      loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
      focusedId: 1102,
      timeline: [{ kind: "entry", id: "e1", characterId: 1102, stageId: "s" }],
      log: [aHit(1102, "Basic Attack", 500)],
    })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent("Saved"))
    const id = result.current.teams[0].id

    // Mutate the live state away from the saved snapshot.
    seedLive({
      slots: [9999, 8888, null],
      timeline: [],
      log: [aHit(9999, "Basic Attack", 1)],
    })

    act(() => result.current.load(id))

    expect(JSON.parse(localStorage.getItem("wuwa.team.slots")!)).toEqual([
      1102,
      null,
      null,
    ])
    expect(JSON.parse(localStorage.getItem("wuwa.team.focusedId")!)).toBe(1102)
    expect(
      JSON.parse(localStorage.getItem("wuwa.timeline.entries")!),
    ).toHaveLength(1)
    // Log is cleared so /sim re-simulates the loaded team fresh.
    expect(JSON.parse(localStorage.getItem("wuwa.simulation-log")!)).toEqual([])
  })
})
