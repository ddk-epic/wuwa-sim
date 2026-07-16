// @vitest-environment node
import { describe, expect, it } from "vitest"
import { decideDrop, isNoOp } from "./useTimelineDrag"
import type { DragSource, DropTarget } from "./useTimelineDrag"

function entrySrc(
  id: string,
  groupId: string | null,
  locked: boolean,
  containerIndex = 0,
): DragSource {
  return { kind: "entry", id, groupId, locked, containerIndex }
}
function groupSrc(id: string, containerIndex = 0): DragSource {
  return { kind: "group", id, containerIndex }
}
function markerSrc(id: string, containerIndex = 0): DragSource {
  return { kind: "loopMarker", id, containerIndex }
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

  // ── group → group ─────────────────────────────────────────
  it("group → other group header: reorderNodes", () => {
    expect(decideDrop(groupSrc("g1"), groupTgt("g2"))).toEqual({
      kind: "reorderNodes",
      from: "g1",
      to: "g2",
    })
  })

  // ── loop marker → top-level only ──────────────────────────
  it("loop marker → top-level entry: reorderNodes", () => {
    expect(decideDrop(markerSrc("m"), entryTgt("b", null, false))).toEqual({
      kind: "reorderNodes",
      from: "m",
      to: "b",
    })
  })
  it("loop marker → group header: reorderNodes", () => {
    expect(decideDrop(markerSrc("m"), groupTgt("g1"))).toEqual({
      kind: "reorderNodes",
      from: "m",
      to: "g1",
    })
  })
  it("loop marker → entry inside a group: none (cannot straddle a group)", () => {
    expect(decideDrop(markerSrc("m"), entryTgt("b", "g1", false))).toEqual({
      kind: "none",
    })
  })
})

describe("isNoOp — no-op detection by container index and position", () => {
  it("above: no-op when target is immediately after source (S+1/above)", () => {
    expect(isNoOp(1, 2, "above")).toBe(true)
    expect(isNoOp(0, 1, "above")).toBe(true)
    expect(isNoOp(4, 5, "above")).toBe(true)
  })

  it("above: not a no-op when target is not S+1", () => {
    expect(isNoOp(1, 3, "above")).toBe(false) // two steps ahead
    expect(isNoOp(2, 1, "above")).toBe(false) // behind
  })

  it("below: no-op when target is immediately before source (S-1/below)", () => {
    expect(isNoOp(2, 1, "below")).toBe(true)
    expect(isNoOp(1, 0, "below")).toBe(true)
    expect(isNoOp(5, 4, "below")).toBe(true)
  })

  it("below: not a no-op when target is not S-1", () => {
    expect(isNoOp(2, 0, "below")).toBe(false) // two steps behind
    expect(isNoOp(1, 2, "below")).toBe(false) // ahead
  })
})
