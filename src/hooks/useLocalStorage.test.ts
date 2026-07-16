// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useLocalStorage } from "./useLocalStorage"

beforeEach(() => {
  localStorage.clear()
})

describe("useLocalStorage", () => {
  it("reads existing value from storage on mount", () => {
    localStorage.setItem("key", JSON.stringify(99))
    const { result } = renderHook(() => useLocalStorage("key", 0))
    expect(result.current[0]).toBe(99)
  })

  it("setValue with a plain value updates state and persists", () => {
    const { result } = renderHook(() => useLocalStorage("key", 0))
    act(() => {
      result.current[1](7)
    })
    expect(result.current[0]).toBe(7)
    expect(JSON.parse(localStorage.getItem("key")!)).toBe(7)
  })

  it("falls back to defaultValue on malformed JSON", () => {
    localStorage.setItem("key", "not-valid-json{{{")
    const { result } = renderHook(() => useLocalStorage("key", "fallback"))
    expect(result.current[0]).toBe("fallback")
  })

  it("updater function receives the current persisted value", () => {
    localStorage.setItem("key", JSON.stringify(100))
    const { result } = renderHook(() => useLocalStorage("key", 0))
    act(() => {
      result.current[1]((prev) => prev * 2)
    })
    expect(result.current[0]).toBe(200)
  })
})
