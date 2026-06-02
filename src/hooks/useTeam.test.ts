// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTeam } from "./useTeam"
import { loadoutFromTemplate } from "#/lib/loadout/template"
import { getCharacterById } from "#/lib/loadout/catalog"

beforeEach(() => {
  localStorage.clear()
})

describe("useTeam — template loadout resolution", () => {
  // The concrete ID resolution is pinned by template.test.ts; here we only
  // verify the wiring: toggleCharacter populates the slot from the template.
  it("adding Encore populates the slot loadout from its template", () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1203) // Encore
    })
    const encore = getCharacterById(1203)!
    expect(result.current.loadouts[0]).toEqual(
      loadoutFromTemplate(encore.template),
    )
  })

  it("adding Sanhua populates the slot loadout from its template", () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1102) // Sanhua
    })
    const sanhua = getCharacterById(1102)!
    expect(result.current.loadouts[0]).toEqual(
      loadoutFromTemplate(sanhua.template),
    )
  })
})

describe("useTeam — setSlotPatch sequence", () => {
  it("setSlotPatch updates sequence on the targeted slot", () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1203)
    })
    act(() => {
      result.current.setSlotPatch(0, { sequence: 4 })
    })
    expect(result.current.loadouts[0].sequence).toBe(4)
  })

  it("setSlotPatch does not affect other slots", () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1203)
      result.current.toggleCharacter(1102)
    })
    act(() => {
      result.current.setSlotPatch(0, { sequence: 2 })
    })
    expect(result.current.loadouts[0].sequence).toBe(2)
    expect(result.current.loadouts[1].sequence).toBe(0)
  })
})

describe("useTeam — focusCharacter", () => {
  it("focusCharacter updates focusedId to the given id", () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1)
      result.current.toggleCharacter(2)
    })
    act(() => {
      result.current.focusCharacter(1)
    })
    expect(result.current.focusedId).toBe(1)
  })
})

describe("useTeam — consolidated wuwa.team object", () => {
  it("defaults to an empty 'New team' and writes one consolidated key", () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1102)
    })
    const stored = JSON.parse(localStorage.getItem("wuwa.team")!)
    expect(stored.name).toBe("New team")
    expect(stored.slots).toEqual([1102, null, null])
    expect(stored.focusedId).toBe(1102)
    expect(stored.originId).toBeNull()
    // The old loose keys are no longer written.
    expect(localStorage.getItem("wuwa.team.slots")).toBeNull()
  })

  it("setName persists the team name across a reload", () => {
    const { result, unmount } = renderHook(() => useTeam())
    act(() => {
      result.current.setName("Rover Hypercarry")
    })
    expect(result.current.name).toBe("Rover Hypercarry")
    unmount()

    // Remounting hydrates the name from localStorage.
    const { result: reloaded } = renderHook(() => useTeam())
    expect(reloaded.current.name).toBe("Rover Hypercarry")
  })

  it("hydrates loadouts merged over defaults from a partial stored object", () => {
    localStorage.setItem(
      "wuwa.team",
      JSON.stringify({
        name: "Partial",
        slots: [1203, null, null],
        loadouts: [{ sequence: 6 }],
        focusedId: 1203,
      }),
    )
    const { result } = renderHook(() => useTeam())
    expect(result.current.name).toBe("Partial")
    expect(result.current.loadouts[0].sequence).toBe(6)
    // Missing fields fall back to defaults.
    expect(result.current.loadouts[0].weaponId).toBeNull()
    expect(result.current.loadouts[1].sequence).toBe(0)
  })
})
