import { describe, expect, it } from "vitest"
import { isDropAllowed } from "./useTimelineDrag"

describe("isDropAllowed", () => {
  it("allows any drop when no drag source is set", () => {
    expect(isDropAllowed(null, null, false)).toBe(true)
    expect(isDropAllowed(null, "g1", true)).toBe(true)
  })

  it("locked-group entry can only re-drop inside its own group", () => {
    const src = { groupId: "g1", locked: true }
    expect(isDropAllowed(src, "g1", true)).toBe(true)
    expect(isDropAllowed(src, "g2", false)).toBe(false)
    expect(isDropAllowed(src, null, false)).toBe(false)
  })

  it("entry from unlocked group can leave to ungrouped", () => {
    const src = { groupId: "g1", locked: false }
    expect(isDropAllowed(src, null, false)).toBe(true)
  })

  it("entry from outside cannot enter a locked group", () => {
    const src = { groupId: null, locked: false }
    expect(isDropAllowed(src, "gLocked", true)).toBe(false)
  })

  it("entry from outside can enter an unlocked group", () => {
    const src = { groupId: null, locked: false }
    expect(isDropAllowed(src, "gOpen", false)).toBe(true)
  })

  it("entry from one unlocked group can move to another unlocked group", () => {
    const src = { groupId: "g1", locked: false }
    expect(isDropAllowed(src, "g2", false)).toBe(true)
  })

  it("entry inside a locked group can re-drop even if its target is locked (same group)", () => {
    const src = { groupId: "gL", locked: true }
    expect(isDropAllowed(src, "gL", true)).toBe(true)
  })
})
