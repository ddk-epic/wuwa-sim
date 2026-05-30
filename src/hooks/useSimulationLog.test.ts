// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { computeSignature, useSimulationLog } from "./useSimulationLog"
import type { SimulationLogEntry } from "#/types/simulation-log"

beforeEach(() => {
  localStorage.clear()
})

const fakeEntry = { id: "e1" } as unknown as SimulationLogEntry

describe("computeSignature", () => {
  it("returns the same value for the same inputs", () => {
    const a = computeSignature([1], {}, [], { reactionDelay: 6 })
    const b = computeSignature([1], {}, [], { reactionDelay: 6 })
    expect(a).toBe(b)
  })

  it("returns different values when inputs differ", () => {
    const a = computeSignature([1], {}, [], { reactionDelay: 6 })
    const b = computeSignature([1], {}, [], { reactionDelay: 7 })
    expect(a).not.toBe(b)
  })

  it("is order-sensitive across arg positions", () => {
    const a = computeSignature("x", "y")
    const b = computeSignature("y", "x")
    expect(a).not.toBe(b)
  })
})

describe("useSimulationLog", () => {
  it("defaults to empty log with empty signature", () => {
    const { result } = renderHook(() => useSimulationLog())
    expect(result.current.log).toEqual([])
    expect(result.current.storedSignature).toBe("")
  })

  it("setLog stores the log and signature", () => {
    const { result } = renderHook(() => useSimulationLog())
    act(() => {
      result.current.setLog([fakeEntry], "abc123")
    })
    expect(result.current.log).toEqual([fakeEntry])
    expect(result.current.storedSignature).toBe("abc123")
  })

  it("clearLog resets to empty log and empty signature", () => {
    const { result } = renderHook(() => useSimulationLog())
    act(() => {
      result.current.setLog([fakeEntry], "abc123")
    })
    act(() => {
      result.current.clearLog()
    })
    expect(result.current.log).toEqual([])
    expect(result.current.storedSignature).toBe("")
  })

  it("migrates a bare-array value from localStorage", () => {
    localStorage.setItem("wuwa.simulation-log", JSON.stringify([fakeEntry]))
    const { result } = renderHook(() => useSimulationLog())
    expect(result.current.log).toEqual([fakeEntry])
    expect(result.current.storedSignature).toBe("")
  })

  it("reads a properly-shaped { log, signature } from localStorage", () => {
    localStorage.setItem(
      "wuwa.simulation-log",
      JSON.stringify({ log: [fakeEntry], signature: "deadbeef" }),
    )
    const { result } = renderHook(() => useSimulationLog())
    expect(result.current.log).toEqual([fakeEntry])
    expect(result.current.storedSignature).toBe("deadbeef")
  })

  it("stale-on-reload: storedSignature differs from current signature after migration", () => {
    // Simulate a previous session that stored a bare log (no signature)
    localStorage.setItem("wuwa.simulation-log", JSON.stringify([fakeEntry]))
    const { result } = renderHook(() => useSimulationLog())
    const currentSig = computeSignature([{ characterId: 1 }], {}, [], {})
    // storedSignature is "" (migrated), currentSig is non-empty → stale
    expect(result.current.storedSignature).not.toBe(currentSig)
  })

  it("not stale when stored signature matches current signature", () => {
    const sig = computeSignature([{ characterId: 1 }], {}, [], {})
    localStorage.setItem(
      "wuwa.simulation-log",
      JSON.stringify({ log: [fakeEntry], signature: sig }),
    )
    const { result } = renderHook(() => useSimulationLog())
    expect(result.current.storedSignature).toBe(sig)
  })
})
