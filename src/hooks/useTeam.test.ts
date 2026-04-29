// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTeam } from "./useTeam"

beforeEach(() => {
  localStorage.clear()
})

describe("useTeam — template loadout resolution", () => {
  it("adding Encore populates loadout with Stringmaster + Inferno Rider + Molten Rift", () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1203) // Encore
    })
    expect(result.current.loadouts[0].weaponId).toBe(21050016) // Stringmaster
    expect(result.current.loadouts[0].echoId).toBe(390080007) // Inferno Rider
    expect(result.current.loadouts[0].echoSetId).toBe(2) // Molten Rift
  })

  it("adding Sanhua populates loadout with Emerald of Genesis + Impermanence Heron + Moonlit Clouds", () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1102) // Sanhua
    })
    expect(result.current.loadouts[0].weaponId).toBe(21020015) // Emerald of Genesis
    expect(result.current.loadouts[0].echoId).toBe(6000052) // Impermanence Heron
    expect(result.current.loadouts[0].echoSetId).toBe(8) // Moonlit Clouds
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

  it("focusCharacter can switch focus back and forth", () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1)
      result.current.toggleCharacter(2)
    })
    act(() => {
      result.current.focusCharacter(1)
    })
    expect(result.current.focusedId).toBe(1)
    act(() => {
      result.current.focusCharacter(2)
    })
    expect(result.current.focusedId).toBe(2)
  })
})
