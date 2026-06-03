// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useModalToggle } from "./useModalToggle"

describe("useModalToggle", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useModalToggle())
    expect(result.current.isOpen).toBe(false)
  })

  it("open() fires onOpen and flips state to open", () => {
    const onOpen = vi.fn()
    const { result } = renderHook(() => useModalToggle({ onOpen }))
    act(() => {
      result.current.open()
    })
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(result.current.isOpen).toBe(true)
  })

  it("close() flips state to closed and fires onClose", () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useModalToggle({ onClose }))
    act(() => {
      result.current.open()
    })
    act(() => {
      result.current.close()
    })
    expect(result.current.isOpen).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("works without callbacks", () => {
    const { result } = renderHook(() => useModalToggle())
    act(() => {
      result.current.open()
    })
    expect(result.current.isOpen).toBe(true)
    act(() => {
      result.current.close()
    })
    expect(result.current.isOpen).toBe(false)
  })
})
