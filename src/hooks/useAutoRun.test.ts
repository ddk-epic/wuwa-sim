// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAutoRun } from "./useAutoRun"

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("useAutoRun — debounce coalescing", () => {
  it("coalesces rapid scheduleRun calls into one run after the debounce delay", () => {
    const runFn = vi.fn()
    const { result } = renderHook(() =>
      useAutoRun({ autoRun: true, needsRun: false, runFn, debounceMs: 300 }),
    )
    act(() => result.current.scheduleRun())
    act(() => result.current.scheduleRun())
    act(() => result.current.scheduleRun())
    expect(runFn).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(300))
    expect(runFn).toHaveBeenCalledTimes(1)
  })

  it("does not schedule a run when autoRun is false", () => {
    const runFn = vi.fn()
    const { result } = renderHook(() =>
      useAutoRun({ autoRun: false, needsRun: false, runFn, debounceMs: 300 }),
    )
    act(() => result.current.scheduleRun())
    act(() => vi.advanceTimersByTime(300))
    expect(runFn).not.toHaveBeenCalled()
  })
})

describe("useAutoRun — cancel-on-open", () => {
  it("cancels the pending debounce when onModalOpen is called", () => {
    const runFn = vi.fn()
    const { result } = renderHook(() =>
      useAutoRun({ autoRun: true, needsRun: false, runFn, debounceMs: 300 }),
    )
    act(() => result.current.scheduleRun())
    act(() => result.current.onModalOpen())
    act(() => vi.advanceTimersByTime(300))
    expect(runFn).not.toHaveBeenCalled()
  })
})

describe("useAutoRun — commit-on-close-if-stale", () => {
  it("runs immediately on onModalClose when autoRun and needsRun are true", () => {
    const runFn = vi.fn()
    const { result } = renderHook(() =>
      useAutoRun({ autoRun: true, needsRun: true, runFn, debounceMs: 300 }),
    )
    // mount run fires once; clear it
    runFn.mockClear()
    act(() => result.current.onModalClose())
    expect(runFn).toHaveBeenCalledTimes(1)
  })

  it("does not run on onModalClose when needsRun is false", () => {
    const runFn = vi.fn()
    const { result } = renderHook(() =>
      useAutoRun({ autoRun: true, needsRun: false, runFn, debounceMs: 300 }),
    )
    act(() => result.current.onModalClose())
    expect(runFn).not.toHaveBeenCalled()
  })

  it("does not run on onModalClose when autoRun is false", () => {
    const runFn = vi.fn()
    const { result } = renderHook(() =>
      useAutoRun({ autoRun: false, needsRun: true, runFn, debounceMs: 300 }),
    )
    act(() => result.current.onModalClose())
    expect(runFn).not.toHaveBeenCalled()
  })
})

describe("useAutoRun — run-on-enable", () => {
  it("runs immediately when autoRun is toggled from false to true and needsRun is true", () => {
    const runFn = vi.fn()
    const { rerender } = renderHook(
      ({ autoRun }: { autoRun: boolean }) =>
        useAutoRun({ autoRun, needsRun: true, runFn, debounceMs: 300 }),
      { initialProps: { autoRun: false } },
    )
    expect(runFn).not.toHaveBeenCalled()
    rerender({ autoRun: true })
    expect(runFn).toHaveBeenCalledTimes(1)
  })

  it("does not run when autoRun is already true on rerender", () => {
    const runFn = vi.fn()
    const { rerender } = renderHook(
      ({ autoRun }: { autoRun: boolean }) =>
        useAutoRun({ autoRun, needsRun: true, runFn, debounceMs: 300 }),
      { initialProps: { autoRun: true } },
    )
    // mount run fires once
    runFn.mockClear()
    rerender({ autoRun: true })
    expect(runFn).not.toHaveBeenCalled()
  })
})

describe("useAutoRun — run-once-on-mount", () => {
  it("runs once on mount when autoRun is true and needsRun is true", () => {
    const runFn = vi.fn()
    renderHook(() =>
      useAutoRun({ autoRun: true, needsRun: true, runFn, debounceMs: 300 }),
    )
    expect(runFn).toHaveBeenCalledTimes(1)
  })

  it("does not run on mount when autoRun is false", () => {
    const runFn = vi.fn()
    renderHook(() =>
      useAutoRun({ autoRun: false, needsRun: true, runFn, debounceMs: 300 }),
    )
    expect(runFn).not.toHaveBeenCalled()
  })

  it("does not run on mount when needsRun is false", () => {
    const runFn = vi.fn()
    renderHook(() =>
      useAutoRun({ autoRun: true, needsRun: false, runFn, debounceMs: 300 }),
    )
    expect(runFn).not.toHaveBeenCalled()
  })
})

describe("useAutoRun — throw-keeps-prior-log", () => {
  it("catches a throw from runFn and keeps the hook stable for subsequent runs", () => {
    const runFn = vi.fn(() => {
      throw new Error("sim error")
    })
    // mount with needsRun=false so the mount effect does not fire
    const { result } = renderHook(() =>
      useAutoRun({ autoRun: true, needsRun: false, runFn, debounceMs: 300 }),
    )
    // Schedule and advance — even though runFn throws, no crash
    act(() => result.current.scheduleRun())
    expect(() => act(() => vi.advanceTimersByTime(300))).not.toThrow()
    expect(runFn).toHaveBeenCalledTimes(1)
    // A subsequent schedule still works
    act(() => result.current.scheduleRun())
    act(() => vi.advanceTimersByTime(300))
    expect(runFn).toHaveBeenCalledTimes(2)
  })
})
