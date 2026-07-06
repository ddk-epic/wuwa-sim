// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useFlashFlag } from "./useFlashFlag"

afterEach(cleanup)

describe("useFlashFlag", () => {
  it("holds the flashed value, then resets after the delay", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useFlashFlag<string | null>(null, 300))

    act(() => result.current[1]("hit"))
    expect(result.current[0]).toBe("hit")

    act(() => vi.advanceTimersByTime(300))
    expect(result.current[0]).toBeNull()

    vi.useRealTimers()
  })

  it("clears the pending timer on unmount", () => {
    vi.useFakeTimers()
    const clear = vi.spyOn(globalThis, "clearTimeout")
    const { result, unmount } = renderHook(() => useFlashFlag(false, 1200))

    act(() => result.current[1](true))
    clear.mockClear()
    unmount()

    expect(clear).toHaveBeenCalledTimes(1)

    clear.mockRestore()
    vi.useRealTimers()
  })
})
