// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAutosaveIndicator } from "./useAutosaveIndicator"

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("useAutosaveIndicator", () => {
  it("starts idle and never transitions on the first snapshot", () => {
    const { result } = renderHook((s) => useAutosaveIndicator(s), {
      initialProps: { name: "a" },
    })
    expect(result.current).toBe("idle")
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current).toBe("idle")
  })

  it("shows saving immediately, saved after 500ms, then hides after 1.5s", () => {
    const { result, rerender } = renderHook((s) => useAutosaveIndicator(s), {
      initialProps: { name: "a" },
    })
    rerender({ name: "b" })
    expect(result.current).toBe("saving")
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe("saved")
    act(() => vi.advanceTimersByTime(1500))
    expect(result.current).toBe("idle")
  })

  it("restarts the 500ms debounce while changes keep arriving", () => {
    const { result, rerender } = renderHook((s) => useAutosaveIndicator(s), {
      initialProps: { name: "a" },
    })
    rerender({ name: "b" })
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe("saving")
    rerender({ name: "c" })
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe("saving")
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe("saved")
  })

  it("snaps back to saving when a change lands during the saved linger", () => {
    const { result, rerender } = renderHook((s) => useAutosaveIndicator(s), {
      initialProps: { name: "a" },
    })
    rerender({ name: "b" })
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe("saved")
    rerender({ name: "c" })
    expect(result.current).toBe("saving")
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe("saved")
  })
})
