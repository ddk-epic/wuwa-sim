// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSettings } from "./useSettings"

beforeEach(() => {
  localStorage.clear()
})

describe("useSettings", () => {
  it("returns default reactionDelay of 9 when storage is empty", () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current[0].reactionDelay).toBe(9)
  })

  it("rehydrates reactionDelay from localStorage", () => {
    localStorage.setItem("wuwa.settings", JSON.stringify({ reactionDelay: 5 }))
    const { result } = renderHook(() => useSettings())
    expect(result.current[0].reactionDelay).toBe(5)
  })

  it("setReactionDelay updates state and persists to localStorage", () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current[1](15)
    })
    expect(result.current[0].reactionDelay).toBe(15)
    expect(
      JSON.parse(localStorage.getItem("wuwa.settings")!).reactionDelay,
    ).toBe(15)
  })

  it("clamps reactionDelay to 0 minimum", () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current[1](-5)
    })
    expect(result.current[0].reactionDelay).toBe(0)
  })

  it("clamps reactionDelay to 60 maximum", () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current[1](99)
    })
    expect(result.current[0].reactionDelay).toBe(60)
  })
})
