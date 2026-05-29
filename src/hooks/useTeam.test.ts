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
