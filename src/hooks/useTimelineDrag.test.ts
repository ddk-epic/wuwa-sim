import { describe, expect, it } from "vitest"
import {
  decideDrop,
  isDropAllowed,
  type DragSource,
  type DropTarget,
} from "./useTimelineDrag"

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

function entrySrc(
  id: string,
  groupId: string | null,
  locked: boolean,
): DragSource {
  return { kind: "entry", id, groupId, locked }
}
function groupSrc(id: string): DragSource {
  return { kind: "group", id }
}
function entryTgt(
  id: string,
  groupId: string | null,
  groupLocked: boolean,
): DropTarget {
  return { kind: "entry", id, groupId, groupLocked }
}
function groupTgt(groupId: string): DropTarget {
  return { kind: "group", groupId }
}

describe("decideDrop policy table", () => {
  // ── self-drops ──────────────────────────────────────────────
  it("returns none when an entry is dropped on itself", () => {
    expect(
      decideDrop(entrySrc("e1", null, false), entryTgt("e1", null, false)),
    ).toEqual({ kind: "none" })
  })
  it("returns none when a group is dropped on itself", () => {
    expect(decideDrop(groupSrc("g1"), groupTgt("g1"))).toEqual({ kind: "none" })
  })

  // ── entry → entry ──────────────────────────────────────────
  it("top-level entry → top-level entry: reorderTopLevelEntry", () => {
    expect(
      decideDrop(entrySrc("a", null, false), entryTgt("b", null, false)),
    ).toEqual({ kind: "reorderTopLevelEntry", from: "a", to: "b" })
  })
  it("entry-in-group → same-group entry: reorderGroupEntries", () => {
    expect(
      decideDrop(entrySrc("a", "g1", false), entryTgt("b", "g1", false)),
    ).toEqual({
      kind: "reorderGroupEntries",
      groupId: "g1",
      from: "a",
      to: "b",
    })
  })
  it("entry-in-group → entry in different unlocked group: none (silent fall-through)", () => {
    expect(
      decideDrop(entrySrc("a", "g1", false), entryTgt("b", "g2", false)),
    ).toEqual({ kind: "none" })
  })
  it("top-level entry → entry-in-group: none (silent fall-through)", () => {
    expect(
      decideDrop(entrySrc("a", null, false), entryTgt("b", "g1", false)),
    ).toEqual({ kind: "none" })
  })
  it("entry-in-group → top-level entry: none (silent fall-through)", () => {
    expect(
      decideDrop(entrySrc("a", "g1", false), entryTgt("b", null, false)),
    ).toEqual({ kind: "none" })
  })

  // ── entry → entry, lock interactions ──────────────────────
  it("top-level entry → entry in locked group: none (lock blocks)", () => {
    expect(
      decideDrop(entrySrc("a", null, false), entryTgt("b", "gL", true)),
    ).toEqual({ kind: "none" })
  })
  it("entry-in-locked-group → same locked group entry: reorderGroupEntries", () => {
    expect(
      decideDrop(entrySrc("a", "gL", true), entryTgt("b", "gL", true)),
    ).toEqual({
      kind: "reorderGroupEntries",
      groupId: "gL",
      from: "a",
      to: "b",
    })
  })
  it("entry-in-locked-group → different group entry: none (lock blocks)", () => {
    expect(
      decideDrop(entrySrc("a", "gL", true), entryTgt("b", "g2", false)),
    ).toEqual({ kind: "none" })
  })
  it("entry from unlocked group → entry in locked different group: none (lock blocks)", () => {
    expect(
      decideDrop(entrySrc("a", "g1", false), entryTgt("b", "gL", true)),
    ).toEqual({ kind: "none" })
  })

  // ── group → entry ──────────────────────────────────────────
  it("group → top-level entry: reorderNodes", () => {
    expect(decideDrop(groupSrc("g1"), entryTgt("b", null, false))).toEqual({
      kind: "reorderNodes",
      from: "g1",
      to: "b",
    })
  })
  it("group → entry-in-group: none (cannot nest groups)", () => {
    expect(decideDrop(groupSrc("g1"), entryTgt("b", "g2", false))).toEqual({
      kind: "none",
    })
  })
  it("group → entry in locked group: none", () => {
    expect(decideDrop(groupSrc("g1"), entryTgt("b", "gL", true))).toEqual({
      kind: "none",
    })
  })

  // ── entry → group header ──────────────────────────────────
  it("top-level entry → group header: reorderNodes(entry, group)", () => {
    expect(decideDrop(entrySrc("a", null, false), groupTgt("g1"))).toEqual({
      kind: "reorderNodes",
      from: "a",
      to: "g1",
    })
  })
  it("entry-in-group → group header: none (silent fall-through)", () => {
    expect(decideDrop(entrySrc("a", "g1", false), groupTgt("g2"))).toEqual({
      kind: "none",
    })
  })
  it("entry-in-locked-group → group header: none", () => {
    expect(decideDrop(entrySrc("a", "gL", true), groupTgt("g2"))).toEqual({
      kind: "none",
    })
  })

  // ── group → group ─────────────────────────────────────────
  it("group → other group header: reorderNodes", () => {
    expect(decideDrop(groupSrc("g1"), groupTgt("g2"))).toEqual({
      kind: "reorderNodes",
      from: "g1",
      to: "g2",
    })
  })
})
