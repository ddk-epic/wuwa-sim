// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTimeline } from "./useTimeline"

beforeEach(() => {
  localStorage.clear()
})

const sample = {
  characterId: 1,
  skillType: "Normal Attack",
  skillName: "Normal Attack · Stage 1",
  attackType: "Basic Attack",
  multiplier: 1.5,
}

describe("useTimeline", () => {
  it("addEntry appends with correct fields", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
    })
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0]).toMatchObject(sample)
    expect(typeof result.current.entries[0].id).toBe("string")
    expect(result.current.entries[0].id.length).toBeGreaterThan(0)
  })

  it("two addEntry calls preserve insertion order", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry({ ...sample, skillName: "Skill A" })
      result.current.addEntry({ ...sample, skillName: "Skill B" })
    })
    expect(result.current.entries[0].skillName).toBe("Skill A")
    expect(result.current.entries[1].skillName).toBe("Skill B")
  })

  it("removeEntry removes only the targeted entry", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
      result.current.addEntry({ ...sample, skillName: "Other" })
    })
    const idToRemove = result.current.entries[0].id
    act(() => {
      result.current.removeEntry(idToRemove)
    })
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].skillName).toBe("Other")
  })

  it("each addEntry produces a distinct id", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
      result.current.addEntry(sample)
      result.current.addEntry(sample)
    })
    const ids = result.current.entries.map((e) => e.id)
    expect(new Set(ids).size).toBe(3)
  })

  it("clearTimeline resets entries to empty array", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
      result.current.addEntry(sample)
    })
    expect(result.current.entries).toHaveLength(2)
    act(() => {
      result.current.clearTimeline()
    })
    expect(result.current.entries).toHaveLength(0)
  })

  it("updateEntry patches variantKind on the target entry", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
    })
    const id = result.current.entries[0].id
    act(() => {
      result.current.updateEntry(id, { variantKind: "cancel" })
    })
    expect(result.current.entries[0].variantKind).toBe("cancel")
    expect(result.current.entries[0].skillName).toBe(sample.skillName)
  })

  it("updateEntry does not mutate other entries", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
      result.current.addEntry({
        ...sample,
        variantKind: "instantCancel" as const,
      })
    })
    const id = result.current.entries[0].id
    act(() => {
      result.current.updateEntry(id, { variantKind: "cancel" })
    })
    expect(result.current.entries[0].variantKind).toBe("cancel")
    expect(result.current.entries[1].variantKind).toBe("instantCancel")
  })

  it("updateEntry is a no-op for unknown ids", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
    })
    act(() => {
      result.current.updateEntry("nonexistent-id", { variantKind: "cancel" })
    })
    expect(result.current.entries[0].variantKind).toBeUndefined()
  })
})
