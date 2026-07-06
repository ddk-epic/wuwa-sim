// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useDebouncedSave } from "./useDebouncedSave"

afterEach(cleanup)

describe("useDebouncedSave", () => {
  it("coalesces rapid queues into a single trailing write of the latest payload", () => {
    vi.useFakeTimers()
    const write = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(write, 400))

    act(() => {
      result.current.queue("a")
      result.current.queue("b")
      result.current.queue("c")
    })
    expect(write).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(400))
    expect(write).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledWith("c")
    vi.useRealTimers()
  })

  it("flush writes the pending payload immediately and cancels the timer", () => {
    vi.useFakeTimers()
    const write = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(write, 400))

    act(() => result.current.queue("x"))
    act(() => result.current.flush())
    expect(write).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledWith("x")

    act(() => vi.advanceTimersByTime(400))
    expect(write).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it("flushes a pending write on unmount", () => {
    vi.useFakeTimers()
    const write = vi.fn()
    const { result, unmount } = renderHook(() => useDebouncedSave(write, 400))

    act(() => result.current.queue("y"))
    unmount()
    expect(write).toHaveBeenCalledWith("y")
    vi.useRealTimers()
  })

  it("flushes a pending write on beforeunload", () => {
    vi.useFakeTimers()
    const write = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(write, 400))

    act(() => result.current.queue("z"))
    act(() => window.dispatchEvent(new Event("beforeunload")))
    expect(write).toHaveBeenCalledWith("z")
    vi.useRealTimers()
  })
})
