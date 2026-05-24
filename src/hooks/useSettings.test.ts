// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSettings } from "./useSettings"

beforeEach(() => {
  localStorage.clear()
})

describe("useSettings", () => {
  it("returns default settings of { reactionDelay: 6, swapFrames: 6, variantFloor: 15 } when storage is empty", () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current[0]).toEqual({
      reactionDelay: 6,
      swapFrames: 6,
      variantFloor: 15,
      fallFrames: 15,
    })
  })

  it("rehydrates settings from localStorage", () => {
    localStorage.setItem(
      "wuwa.settings",
      JSON.stringify({ reactionDelay: 5, swapFrames: 10, variantFloor: 20 }),
    )
    const { result } = renderHook(() => useSettings())
    expect(result.current[0]).toEqual({
      reactionDelay: 5,
      swapFrames: 10,
      variantFloor: 20,
      fallFrames: 15,
    })
  })

  it("merges legacy localStorage entry lacking swapFrames with defaults", () => {
    localStorage.setItem("wuwa.settings", JSON.stringify({ reactionDelay: 9 }))
    const { result } = renderHook(() => useSettings())
    expect(result.current[0].reactionDelay).toBe(9)
    expect(result.current[0].swapFrames).toBe(6)
    expect(result.current[0].variantFloor).toBe(15)
  })

  it("merges legacy localStorage entry lacking variantFloor with default", () => {
    localStorage.setItem(
      "wuwa.settings",
      JSON.stringify({ reactionDelay: 5, swapFrames: 10 }),
    )
    const { result } = renderHook(() => useSettings())
    expect(result.current[0].variantFloor).toBe(15)
  })

  it("merges legacy localStorage entry lacking fallFrames with default 15", () => {
    localStorage.setItem(
      "wuwa.settings",
      JSON.stringify({ reactionDelay: 6, swapFrames: 6, variantFloor: 15 }),
    )
    const { result } = renderHook(() => useSettings())
    expect(result.current[0].fallFrames).toBe(15)
  })

  it("patch setter updates reactionDelay and persists", () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current[1]({ reactionDelay: 15 })
    })
    expect(result.current[0].reactionDelay).toBe(15)
    expect(result.current[0].swapFrames).toBe(6)
    expect(result.current[0].variantFloor).toBe(15)
    expect(JSON.parse(localStorage.getItem("wuwa.settings")!)).toEqual({
      reactionDelay: 15,
      swapFrames: 6,
      variantFloor: 15,
      fallFrames: 15,
    })
  })

  it("patch setter updates swapFrames independently", () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current[1]({ swapFrames: 12 })
    })
    expect(result.current[0].reactionDelay).toBe(6)
    expect(result.current[0].swapFrames).toBe(12)
  })

  it("patch setter updates variantFloor independently", () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current[1]({ variantFloor: 30 })
    })
    expect(result.current[0].variantFloor).toBe(30)
    expect(result.current[0].reactionDelay).toBe(6)
    expect(result.current[0].swapFrames).toBe(6)
  })

  it("clamps reactionDelay to 0 minimum", () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current[1]({ reactionDelay: -5 })
    })
    expect(result.current[0].reactionDelay).toBe(0)
  })

  it("clamps reactionDelay to 60 maximum", () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current[1]({ reactionDelay: 99 })
    })
    expect(result.current[0].reactionDelay).toBe(60)
  })

  it("clamps swapFrames to [0, 60]", () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current[1]({ swapFrames: -5 })
    })
    expect(result.current[0].swapFrames).toBe(0)
    act(() => {
      result.current[1]({ swapFrames: 99 })
    })
    expect(result.current[0].swapFrames).toBe(60)
  })

  it("clamps variantFloor to [0, 60]", () => {
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current[1]({ variantFloor: -5 })
    })
    expect(result.current[0].variantFloor).toBe(0)
    act(() => {
      result.current[1]({ variantFloor: 99 })
    })
    expect(result.current[0].variantFloor).toBe(60)
  })
})
