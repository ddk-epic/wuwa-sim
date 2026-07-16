// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { SlotLoadout } from "#/types/loadout"
import { encodePayload } from "#/lib/import-export"
import type { ImportExportPayload } from "#/lib/import-export"
import { DEFAULT_SETTINGS } from "#/lib/settings"
import { moveDraftToLive, useLibrary } from "./useLibrary"

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
function emptyPayload(name = ""): ImportExportPayload {
  return {
    team: {
      name,
      slots: [null, null, null],
      loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
      focusedId: null,
    },
    timeline: null,
  }
}

/** Seed the live `wuwa.*` keys that `saveCurrent` snapshots. */
function seedLive(opts: {
  name?: string
  slots?: unknown
  loadouts?: unknown
  focusedId?: unknown
  originId?: unknown
  settings?: unknown
  timeline?: unknown
  log?: unknown
}) {
  const team = {
    name: opts.name ?? "New team",
    slots: opts.slots ?? [null, null, null],
    loadouts: opts.loadouts ?? [emptyLoadout(), emptyLoadout(), emptyLoadout()],
    focusedId: opts.focusedId ?? null,
    originId: opts.originId ?? null,
    ...(opts.settings !== undefined ? { settings: opts.settings } : {}),
  }
  localStorage.setItem("wuwa.team", JSON.stringify(team))
  if (opts.timeline !== undefined)
    localStorage.setItem("wuwa.timeline.entries", JSON.stringify(opts.timeline))
  if (opts.log !== undefined)
    localStorage.setItem("wuwa.simulation-log", JSON.stringify(opts.log))
}

/** Read back the consolidated live team object. */
function readLiveTeam() {
  return JSON.parse(localStorage.getItem("wuwa.team")!)
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

  it("saveCurrent snapshots the live keys (incl. name) into a new SavedTeam with computed stats", () => {
    seedLive({
      name: "My Team",
      slots: [1102, null, null],
      loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
      focusedId: 1102,
      timeline: [{ kind: "entry", id: "e1", characterId: 1102, stageId: "s" }],
      log: [aHit(1102, "Basic Attack", 500), aHit(1102, "Heavy Attack", 300)],
    })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent(null))

    expect(result.current.teams).toHaveLength(1)
    const team = result.current.teams[0]
    // The save path captures the live team name.
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

  it("saveCurrent reads the wrapped { log, signature } simulation-log shape", () => {
    // After a simulation runs, wuwa.simulation-log is an object, not a bare
    // array — snapshotLive must normalize it before computing stats.
    seedLive({ name: "Ran", slots: [1102, null, null] })
    localStorage.setItem(
      "wuwa.simulation-log",
      JSON.stringify({
        log: [aHit(1102, "Basic Attack", 250), aHit(1102, "Heavy Attack", 150)],
        signature: "abc123",
      }),
    )
    const { result } = renderHook(() => useLibrary())
    let savedId = ""
    act(() => {
      savedId = result.current.saveCurrent(null)
    })
    expect(savedId).toBeTruthy()
    expect(result.current.teams).toHaveLength(1)
    expect(result.current.teams[0].stats.dmgByChar).toEqual({ 1102: 400 })
  })

  it("saveCurrent(null) always creates a fresh entry (new team / import path)", () => {
    seedLive({ name: "A" })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent(null))
    act(() => result.current.saveCurrent(null))
    expect(result.current.teams).toHaveLength(2)
    expect(result.current.teams[0].id).not.toBe(result.current.teams[1].id)
  })

  it("duplicate appends a detached copy with a new id", () => {
    seedLive({ name: "Base" })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent(null))
    const id = result.current.teams[0].id
    act(() => result.current.duplicate(id))
    expect(result.current.teams).toHaveLength(2)
    expect(result.current.teams[1].id).not.toBe(id)
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

  it("importBundle falls back to a placeholder when the bundle has no name", () => {
    const code = encodePayload(emptyPayload(""))
    const { result } = renderHook(() => useLibrary())
    act(() => {
      result.current.importBundle(code)
    })
    expect(result.current.teams[0].name).toBe("Imported team")
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

  it("load writes the saved payload + name into the live team object and clears the log", () => {
    seedLive({
      name: "Saved",
      slots: [1102, null, null],
      loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
      focusedId: 1102,
      timeline: [{ kind: "entry", id: "e1", characterId: 1102, stageId: "s" }],
      log: [aHit(1102, "Basic Attack", 500)],
    })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent(null))
    const id = result.current.teams[0].id

    // Mutate the live state away from the saved snapshot.
    seedLive({
      name: "Different",
      slots: [9999, 8888, null],
      timeline: [],
      log: [aHit(9999, "Basic Attack", 1)],
    })

    act(() => result.current.load(id))

    const live = readLiveTeam()
    expect(live.slots).toEqual([1102, null, null])
    expect(live.focusedId).toBe(1102)
    // The saved name round-trips back into the live team.
    expect(live.name).toBe("Saved")
    // load stamps the loaded entry's id as the live Origin.
    expect(live.originId).toBe(id)
    expect(
      JSON.parse(localStorage.getItem("wuwa.timeline.entries")!),
    ).toHaveLength(1)
    // Log is cleared so /sim re-simulates the loaded team fresh.
    expect(JSON.parse(localStorage.getItem("wuwa.simulation-log")!)).toEqual([])
  })

  it("round-trips per-team settings through save then load", () => {
    seedLive({
      name: "Tuned",
      slots: [1102, null, null],
      settings: {
        reactionDelay: 12,
        swapFrames: 9,
        variantFloor: 21,
        fallFrames: 3,
        startWithFullEnergy: true,
      },
    })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent(null))
    const id = result.current.teams[0].id
    expect(result.current.teams[0].payload.team.settings).toEqual({
      reactionDelay: 12,
      swapFrames: 9,
      variantFloor: 21,
      fallFrames: 3,
      startWithFullEnergy: true,
      startWithFullConcerto: false,
    })

    // Live settings drift; loading restores the saved ones.
    seedLive({ name: "Scratch", slots: [null, null, null] })
    act(() => result.current.load(id))
    expect(readLiveTeam().settings).toEqual({
      reactionDelay: 12,
      swapFrames: 9,
      variantFloor: 21,
      fallFrames: 3,
      startWithFullEnergy: true,
      startWithFullConcerto: false,
    })
  })

  it("loading a legacy saved team (no settings) restores the defaults", () => {
    localStorage.setItem(
      "wuwa.library",
      JSON.stringify([
        {
          id: "legacy",
          name: "Legacy",
          updated: 1,
          pinned: false,
          payload: emptyPayload("Legacy"),
          stats: { dmgByChar: {}, typeMix: {}, concertoEnd: 0, resEnd: 0 },
        },
      ]),
    )
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.load("legacy"))
    expect(readLiveTeam().settings).toEqual(DEFAULT_SETTINGS)
  })

  it("saveCurrent updates the origin entry in place (no duplicate)", () => {
    seedLive({ name: "First", slots: [1102, null, null] })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent(null))
    const id = result.current.teams[0].id

    // Edit the live team, then Save against the same Origin.
    seedLive({
      name: "Renamed",
      slots: [1102, 1203, null],
      log: [aHit(1102, "Basic Attack", 700)],
    })
    let savedId = ""
    act(() => {
      savedId = result.current.saveCurrent(id)
    })

    expect(savedId).toBe(id)
    expect(result.current.teams).toHaveLength(1)
    const team = result.current.teams[0]
    expect(team.id).toBe(id)
    expect(team.name).toBe("Renamed")
    expect(team.payload.team.slots).toEqual([1102, 1203, null])
    expect(team.stats.dmgByChar).toEqual({ 1102: 700 })
  })

  it("saveCurrent against a dangling Origin creates rather than no-ops", () => {
    seedLive({ name: "Ghost", slots: [1102, null, null] })
    const { result } = renderHook(() => useLibrary())
    let savedId = ""
    act(() => {
      savedId = result.current.saveCurrent("does-not-exist")
    })
    expect(result.current.teams).toHaveLength(1)
    expect(savedId).toBe(result.current.teams[0].id)
    expect(savedId).not.toBe("does-not-exist")
  })

  it("updateTeam overwrites payload/stats/name/updated, keeping id + pinned", () => {
    seedLive({ name: "Base", slots: [1102, null, null] })
    const { result } = renderHook(() => useLibrary())
    act(() => result.current.saveCurrent(null))
    const id = result.current.teams[0].id
    act(() => result.current.togglePin(id))
    const before = result.current.teams[0].updated

    const payload = emptyPayload("Updated")
    payload.team.slots = [1203, null, null]
    act(() =>
      result.current.updateTeam(id, "Updated", payload, {
        dmgByChar: { 1203: 42 },
        typeMix: {},
        concertoEnd: 0,
        resEnd: 0,
      }),
    )

    const team = result.current.teams[0]
    expect(result.current.teams).toHaveLength(1)
    expect(team.id).toBe(id)
    expect(team.pinned).toBe(true) // preserved
    expect(team.name).toBe("Updated")
    expect(team.payload.team.slots).toEqual([1203, null, null])
    expect(team.stats.dmgByChar).toEqual({ 1203: 42 })
    expect(team.updated).toBeGreaterThanOrEqual(before)
  })

  it("moveDraftToLive lands the draft composition + name in the live Session with null Origin", () => {
    // A pre-existing live Session that the draft should overwrite.
    seedLive({
      name: "Old live",
      slots: [9999, null, null],
      originId: "some-origin",
      timeline: [{ kind: "entry", id: "e", characterId: 9999, stageId: "s" }],
      log: [aHit(9999, "Basic Attack", 5)],
    })

    moveDraftToLive({
      name: "Drafted",
      slots: [1102, 1203, null],
      loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
      focusedId: 1102,
    })

    const live = readLiveTeam()
    expect(live.name).toBe("Drafted")
    expect(live.slots).toEqual([1102, 1203, null])
    expect(live.focusedId).toBe(1102)
    // A drafted team is unsaved — it has no Origin.
    expect(live.originId).toBeNull()
    // The new composition starts with a clean timeline + log.
    expect(JSON.parse(localStorage.getItem("wuwa.timeline.entries")!)).toEqual(
      [],
    )
    expect(JSON.parse(localStorage.getItem("wuwa.simulation-log")!)).toEqual([])
    // Nothing is written to the Library.
    expect(localStorage.getItem("wuwa.library")).toBeNull()
  })

  it("updateTeam falls back to create when the id is unknown", () => {
    const { result } = renderHook(() => useLibrary())
    act(() =>
      result.current.updateTeam("missing", "Fresh", emptyPayload("Fresh"), {
        dmgByChar: {},
        typeMix: {},
        concertoEnd: 0,
        resEnd: 0,
      }),
    )
    expect(result.current.teams).toHaveLength(1)
    expect(result.current.teams[0].name).toBe("Fresh")
    expect(result.current.teams[0].id).not.toBe("missing")
  })
})
