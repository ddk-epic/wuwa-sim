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
    expect(result.current.loadouts[0].echoSetSlot1Id).toBe(2) // Molten Rift
    expect(result.current.loadouts[0].echoSetSlot2Id).toBe(2) // Molten Rift (5pc)
  })

  it("adding Sanhua populates loadout with Emerald of Genesis + Impermanence Heron + Moonlit Clouds", () => {
    const { result } = renderHook(() => useTeam())
    act(() => {
      result.current.toggleCharacter(1102) // Sanhua
    })
    expect(result.current.loadouts[0].weaponId).toBe(21020015) // Emerald of Genesis
    expect(result.current.loadouts[0].echoId).toBe(6000052) // Impermanence Heron
    expect(result.current.loadouts[0].echoSetSlot1Id).toBe(8) // Moonlit Clouds
    expect(result.current.loadouts[0].echoSetSlot2Id).toBe(8) // Moonlit Clouds (5pc)
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
