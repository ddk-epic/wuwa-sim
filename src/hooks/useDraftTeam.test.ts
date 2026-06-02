// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useDraftTeam } from "./useDraftTeam"
import { loadoutFromTemplate } from "#/lib/loadout/template"
import { getCharacterById } from "#/lib/loadout/catalog"

beforeEach(() => {
  localStorage.clear()
})

describe("useDraftTeam", () => {
  it("defaults to an empty-named draft so the dynamic placeholder shows", () => {
    const { result } = renderHook(() => useDraftTeam())
    expect(result.current.name).toBe("")
    expect(result.current.slots).toEqual([null, null, null])
    expect(result.current.selectedCount).toBe(0)
  })

  it("edits the draft via the same interface as useTeam — no live keys written", () => {
    const { result } = renderHook(() => useDraftTeam())
    act(() => {
      result.current.setName("Glacio Burst")
      result.current.toggleCharacter(1102) // Sanhua
    })
    act(() => {
      result.current.setSlotPatch(0, { sequence: 5 })
    })

    expect(result.current.name).toBe("Glacio Burst")
    expect(result.current.slots).toEqual([1102, null, null])
    expect(result.current.focusedId).toBe(1102)
    expect(result.current.loadouts[0].sequence).toBe(5)
    // Toggling resolves the loadout from the character template, like useTeam.
    const sanhua = getCharacterById(1102)!
    expect(result.current.loadouts[0]).toEqual({
      ...loadoutFromTemplate(sanhua.template),
      sequence: 5,
    })

    // The draft is in-memory only — it must never touch the live Session keys.
    expect(localStorage.getItem("wuwa.team")).toBeNull()
    expect(localStorage.getItem("wuwa.library")).toBeNull()
  })
})
