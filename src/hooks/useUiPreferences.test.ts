// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useUiPreferences } from "./useUiPreferences"

beforeEach(() => {
  localStorage.clear()
})

describe("useUiPreferences", () => {
  it("returns default preferences { autoRun: true, defaultLogVariant: table } when storage is empty", () => {
    const { result } = renderHook(() => useUiPreferences())
    expect(result.current[0]).toEqual({
      autoRun: true,
      defaultLogVariant: "table",
    })
  })

  it("rehydrates autoRun: false from localStorage", () => {
    localStorage.setItem("wuwa.preferences", JSON.stringify({ autoRun: false }))
    const { result } = renderHook(() => useUiPreferences())
    expect(result.current[0].autoRun).toBe(false)
  })

  it("patch setter updates autoRun and persists", () => {
    const { result } = renderHook(() => useUiPreferences())
    act(() => {
      result.current[1]({ autoRun: false })
    })
    expect(result.current[0].autoRun).toBe(false)
    expect(JSON.parse(localStorage.getItem("wuwa.preferences")!)).toEqual({
      autoRun: false,
      defaultLogVariant: "table",
    })
  })

  it("falls back to defaults for invalid stored value", () => {
    localStorage.setItem("wuwa.preferences", "not-json-object")
    const { result } = renderHook(() => useUiPreferences())
    expect(result.current[0]).toEqual({
      autoRun: true,
      defaultLogVariant: "table",
    })
  })

  it("rehydrates defaultLogVariant: timeline from localStorage", () => {
    localStorage.setItem(
      "wuwa.preferences",
      JSON.stringify({ defaultLogVariant: "timeline" }),
    )
    const { result } = renderHook(() => useUiPreferences())
    expect(result.current[0].defaultLogVariant).toBe("timeline")
  })

  it("falls back to table for an invalid defaultLogVariant", () => {
    localStorage.setItem(
      "wuwa.preferences",
      JSON.stringify({ defaultLogVariant: "nonsense" }),
    )
    const { result } = renderHook(() => useUiPreferences())
    expect(result.current[0].defaultLogVariant).toBe("table")
  })

  it("patch setter updates defaultLogVariant and persists", () => {
    const { result } = renderHook(() => useUiPreferences())
    act(() => {
      result.current[1]({ defaultLogVariant: "timeline" })
    })
    expect(result.current[0].defaultLogVariant).toBe("timeline")
  })
})
