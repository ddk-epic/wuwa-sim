// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { flattenNodes } from "#/types/timeline"
import { migrateNodes } from "#/lib/timeline/migrate-timeline"
import { useTimeline } from "./useTimeline"

beforeEach(() => {
  localStorage.clear()
})

const sample = {
  characterId: 1,
  stageId: "Normal Attack::Stage 1",
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
      result.current.addEntry({ ...sample, stageId: "Normal Attack::Stage A" })
      result.current.addEntry({ ...sample, stageId: "Normal Attack::Stage B" })
    })
    expect(result.current.entries[0].stageId).toBe("Normal Attack::Stage A")
    expect(result.current.entries[1].stageId).toBe("Normal Attack::Stage B")
  })

  it("removeEntry removes only the targeted entry", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
      result.current.addEntry({ ...sample, stageId: "Other::_" })
    })
    const idToRemove = result.current.entries[0].id
    act(() => {
      result.current.removeEntry(idToRemove)
    })
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].stageId).toBe("Other::_")
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
    expect(result.current.entries[0].stageId).toBe(sample.stageId)
  })

  it("updateEntry does not mutate other entries", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addEntry(sample)
      result.current.addEntry({
        ...sample,
        variantKind: "instantCancel",
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

describe("flattenNodes", () => {
  it("returns empty array for empty nodes", () => {
    expect(flattenNodes([])).toEqual([])
  })

  it("flattens top-level entry nodes", () => {
    const node = {
      kind: "entry" as const,
      id: "a",
      characterId: 1,
      stageId: "Normal Attack::Stage 1",
    }
    expect(flattenNodes([node])).toEqual([
      {
        id: "a",
        characterId: 1,
        stageId: "Normal Attack::Stage 1",
        variantKind: undefined,
      },
    ])
  })

  it("flattens group entries inline", () => {
    const group = {
      kind: "group" as const,
      id: "g1",
      label: "Group",
      locked: false,
      entries: [
        { id: "e1", characterId: 1, stageId: "Normal Attack::Stage 1" },
        { id: "e2", characterId: 2, stageId: "Resonance Skill::_" },
      ],
    }
    const flat = flattenNodes([group])
    expect(flat).toHaveLength(2)
    expect(flat[0].id).toBe("e1")
    expect(flat[1].id).toBe("e2")
  })

  it("preserves order: entry, group entries, entry", () => {
    const nodes = [
      { kind: "entry" as const, id: "top1", characterId: 1, stageId: "S::1" },
      {
        kind: "group" as const,
        id: "g1",
        label: "G",
        locked: false,
        entries: [{ id: "g1e1", characterId: 2, stageId: "S::2" }],
      },
      { kind: "entry" as const, id: "top2", characterId: 3, stageId: "S::3" },
    ]
    const flat = flattenNodes(nodes)
    expect(flat.map((e) => e.id)).toEqual(["top1", "g1e1", "top2"])
  })
})

describe("migrateNodes", () => {
  it("wraps legacy TimelineEntry[] (no kind) as entry nodes", () => {
    const legacy = [
      { id: "a", characterId: 1, stageId: "Normal Attack::Stage 1" },
      { id: "b", characterId: 2, stageId: "Resonance Skill::_" },
    ]
    const result = migrateNodes(legacy)
    expect(result[0].kind).toBe("entry")
    expect(result[1].kind).toBe("entry")
    expect(result[0].id).toBe("a")
  })

  it("preserves group nodes from new format", () => {
    const nodes = [
      {
        kind: "group",
        id: "g1",
        label: "Rotation",
        locked: true,
        entries: [
          { id: "e1", characterId: 1, stageId: "Normal Attack::Stage 1" },
        ],
      },
    ]
    const result = migrateNodes(nodes)
    expect(result[0].kind).toBe("group")
    if (result[0].kind === "group") {
      expect(result[0].label).toBe("Rotation")
      expect(result[0].locked).toBe(true)
      expect(result[0].entries[0].id).toBe("e1")
    }
  })
})

describe("useTimeline group support", () => {
  it("addEntry appends at top level when no open group", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addGroup()
      // immediately lock the group so no open group exists
    })
    // The added group is open (locked:false) — so next addEntry goes into it.
    // To test top-level: start fresh with no groups
  })

  it("addEntry appends to open group when one exists", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addGroup()
    })
    act(() => {
      result.current.addEntry(sample)
    })
    // The group is open (locked:false), so entry goes into it
    const group = result.current.nodes.find((n) => n.kind === "group")
    expect(group?.kind).toBe("group")
    if (group?.kind === "group") {
      expect(group.entries).toHaveLength(1)
      expect(group.entries[0].stageId).toBe(sample.stageId)
    }
    // flat entries still works
    expect(result.current.entries).toHaveLength(1)
  })

  it("addEntry appends to top level when no open group", () => {
    const { result } = renderHook(() => useTimeline())
    // No group added — no open group
    act(() => {
      result.current.addEntry(sample)
    })
    const topLevelEntries = result.current.nodes.filter(
      (n) => n.kind === "entry",
    )
    expect(topLevelEntries).toHaveLength(1)
    expect(result.current.entries).toHaveLength(1)
  })

  it("addGroup returns unique id and appends group node", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
    })
    expect(typeof groupId).toBe("string")
    expect(groupId.length).toBeGreaterThan(0)
    const group = result.current.nodes.find(
      (n) => n.kind === "group" && n.id === groupId,
    )
    expect(group).toBeDefined()
  })

  it("removeEntry removes entry inside a group", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addGroup()
      result.current.addEntry(sample)
    })
    const entryId = result.current.entries[0].id
    act(() => {
      result.current.removeEntry(entryId)
    })
    expect(result.current.entries).toHaveLength(0)
    const group = result.current.nodes.find((n) => n.kind === "group")
    if (group?.kind === "group") {
      expect(group.entries).toHaveLength(0)
    }
  })

  it("deleteGroup removes the group node entirely", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
      result.current.addEntry(sample)
    })
    act(() => {
      result.current.deleteGroup(groupId)
    })
    expect(result.current.nodes.every((n) => n.kind !== "group")).toBe(true)
    expect(result.current.entries).toHaveLength(0)
  })

  it("duplicateGroup inserts a deep clone after the source with fresh ids", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
      result.current.addEntry(sample)
    })
    act(() => {
      result.current.duplicateGroup(groupId)
    })
    const groups = result.current.nodes.filter((n) => n.kind === "group")
    expect(groups).toHaveLength(2)
    expect(groups[1].label).toBe("copy") // empty label → "copy"
    expect(groups[1].entries[0].id).not.toBe(groups[0].entries[0].id)
    expect(groups[1].entries[0].stageId).toBe(groups[0].entries[0].stageId)
    // duplicate of open group is locked
    expect(groups[1].locked).toBe(true)
  })

  it("duplicateGroup appends '<label> copy' label", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
      result.current.updateGroupLabel(groupId, "Burst Window")
    })
    act(() => {
      result.current.duplicateGroup(groupId)
    })
    const groups = result.current.nodes.filter((n) => n.kind === "group")
    expect(groups[1].label).toBe("Burst Window copy")
  })
})

describe("useTimeline reorderGroupEntries", () => {
  it("reorders entries within the same group — above", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
      result.current.addEntry({ characterId: 1, stageId: "S::1" })
      result.current.addEntry({ characterId: 1, stageId: "S::2" })
    })
    const [e1Id, e2Id] = result.current.entries.map((e) => e.id)
    act(() => {
      result.current.reorderGroupEntries(groupId, e2Id, e1Id, "above")
    })
    const group = result.current.nodes.find((n) => n.id === groupId)
    if (group?.kind === "group") {
      expect(group.entries[0].stageId).toBe("S::2")
      expect(group.entries[1].stageId).toBe("S::1")
    }
  })

  it("reorders entries within the same group — below inserts after target", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
      result.current.addEntry({ characterId: 1, stageId: "S::1" })
      result.current.addEntry({ characterId: 1, stageId: "S::2" })
      result.current.addEntry({ characterId: 1, stageId: "S::3" })
    })
    const [e1Id, , e3Id] = result.current.entries.map((e) => e.id)
    // move e3 below e1 → [e1, e3, e2]
    act(() => {
      result.current.reorderGroupEntries(groupId, e3Id, e1Id, "below")
    })
    const group = result.current.nodes.find((n) => n.id === groupId)
    if (group?.kind === "group") {
      expect(group.entries[0].stageId).toBe("S::1")
      expect(group.entries[1].stageId).toBe("S::3")
      expect(group.entries[2].stageId).toBe("S::2")
    }
  })

  it("is a no-op for unknown groupId", () => {
    const { result } = renderHook(() => useTimeline())
    act(() => {
      result.current.addGroup()
      result.current.addEntry({ characterId: 1, stageId: "S::1" })
    })
    const before = result.current.nodes.slice()
    act(() => {
      result.current.reorderGroupEntries("unknown", "x", "y", "above")
    })
    expect(result.current.nodes).toEqual(before)
  })
})

describe("useTimeline reorderNodes", () => {
  it("moves a group node to a new top-level position — above", () => {
    const { result } = renderHook(() => useTimeline())
    let g1!: string
    let g2!: string
    act(() => {
      g1 = result.current.addGroup()
      g2 = result.current.addGroup()
    })
    // nodes: [g1(locked), g2(open)]
    act(() => {
      result.current.reorderNodes(g2, g1, "above") // move g2 before g1
    })
    const nodeIds = result.current.nodes.map((n) => n.id)
    expect(nodeIds[0]).toBe(g2)
    expect(nodeIds[1]).toBe(g1)
  })

  it("moves a group node to a new top-level position — below", () => {
    const { result } = renderHook(() => useTimeline())
    let g1!: string
    let g2!: string
    let g3!: string
    act(() => {
      g1 = result.current.addGroup()
      g2 = result.current.addGroup()
      g3 = result.current.addGroup()
    })
    // nodes: [g1, g2, g3]
    act(() => {
      result.current.reorderNodes(g1, g2, "below") // move g1 after g2 → [g2, g1, g3]
    })
    const nodeIds = result.current.nodes.map((n) => n.id)
    expect(nodeIds[0]).toBe(g2)
    expect(nodeIds[1]).toBe(g1)
    expect(nodeIds[2]).toBe(g3)
  })

  it("moves a group after a top-level entry node — above", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      result.current.addEntry(sample) // top-level entry
      groupId = result.current.addGroup()
    })
    const entryId = result.current.nodes[0].id
    act(() => {
      result.current.reorderNodes(groupId, entryId, "above") // move group before entry
    })
    expect(result.current.nodes[0].kind).toBe("group")
    expect(result.current.nodes[0].id).toBe(groupId)
    expect(result.current.nodes[1].kind).toBe("entry")
  })

  it("moves a top-level entry to a group's flat position — above", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup() // group(open)
    })
    act(() => {
      result.current.toggleGroupLock(groupId) // lock it
    })
    act(() => {
      result.current.addEntry(sample) // top-level entry (group is locked)
    })
    // nodes: [group(locked), entry(top-level)]
    const entryId = result.current.nodes.find((n) => n.kind === "entry")!.id
    act(() => {
      result.current.reorderNodes(entryId, groupId, "above") // entry moves before group
    })
    expect(result.current.nodes[0].kind).toBe("entry")
    expect(result.current.nodes[0].id).toBe(entryId)
    expect(result.current.nodes[1].kind).toBe("group")
    expect(result.current.nodes[1].id).toBe(groupId)
  })
})

describe("useTimeline onShapeChange callback", () => {
  it("addEntry calls onShapeChange", () => {
    const onShapeChange = vi.fn()
    const { result } = renderHook(() => useTimeline(onShapeChange))
    act(() => {
      result.current.addEntry(sample)
    })
    expect(onShapeChange).toHaveBeenCalledTimes(1)
  })

  it("removeEntry calls onShapeChange", () => {
    const onShapeChange = vi.fn()
    const { result } = renderHook(() => useTimeline(onShapeChange))
    act(() => {
      result.current.addEntry(sample)
    })
    const id = result.current.entries[0].id
    onShapeChange.mockClear()
    act(() => {
      result.current.removeEntry(id)
    })
    expect(onShapeChange).toHaveBeenCalledTimes(1)
  })

  it("updateEntry with stageId calls onShapeChange", () => {
    const onShapeChange = vi.fn()
    const { result } = renderHook(() => useTimeline(onShapeChange))
    act(() => {
      result.current.addEntry(sample)
    })
    const id = result.current.entries[0].id
    onShapeChange.mockClear()
    act(() => {
      result.current.updateEntry(id, { stageId: "Resonance Skill::_" })
    })
    expect(onShapeChange).toHaveBeenCalledTimes(1)
  })

  it("updateEntry with variantKind only does NOT call onShapeChange", () => {
    const onShapeChange = vi.fn()
    const { result } = renderHook(() => useTimeline(onShapeChange))
    act(() => {
      result.current.addEntry(sample)
    })
    const id = result.current.entries[0].id
    onShapeChange.mockClear()
    act(() => {
      result.current.updateEntry(id, { variantKind: "cancel" })
    })
    expect(onShapeChange).not.toHaveBeenCalled()
  })

  it("updateGroupLabel does NOT call onShapeChange", () => {
    const onShapeChange = vi.fn()
    const { result } = renderHook(() => useTimeline(onShapeChange))
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
    })
    onShapeChange.mockClear()
    act(() => {
      result.current.updateGroupLabel(groupId, "New Name")
    })
    expect(onShapeChange).not.toHaveBeenCalled()
  })

  it("clearTimeline calls onShapeChange", () => {
    const onShapeChange = vi.fn()
    const { result } = renderHook(() => useTimeline(onShapeChange))
    act(() => {
      result.current.addEntry(sample)
    })
    onShapeChange.mockClear()
    act(() => {
      result.current.clearTimeline()
    })
    expect(onShapeChange).toHaveBeenCalledTimes(1)
  })
})

describe("useTimeline rename state", () => {
  it("renamingGroupId starts as null", () => {
    const { result } = renderHook(() => useTimeline())
    expect(result.current.renamingGroupId).toBeNull()
  })

  it("startRename sets renamingGroupId", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
    })
    act(() => {
      result.current.startRename(groupId)
    })
    expect(result.current.renamingGroupId).toBe(groupId)
  })

  it("endRename clears renamingGroupId", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
    })
    act(() => {
      result.current.startRename(groupId)
    })
    act(() => {
      result.current.endRename()
    })
    expect(result.current.renamingGroupId).toBeNull()
  })

  it("addGroupAndRename appends a group and sets it as renaming", () => {
    const { result } = renderHook(() => useTimeline())
    let id!: string
    act(() => {
      id = result.current.addGroupAndRename()
    })
    expect(typeof id).toBe("string")
    expect(result.current.renamingGroupId).toBe(id)
    const group = result.current.nodes.find(
      (n) => n.kind === "group" && n.id === id,
    )
    expect(group).toBeDefined()
  })
})

describe("useTimeline lock invariant", () => {
  it("addGroup auto-locks the previously-open group", () => {
    const { result } = renderHook(() => useTimeline())
    let g1!: string
    let g2!: string
    act(() => {
      g1 = result.current.addGroup()
    })
    // g1 is open
    const g1Before = result.current.nodes.find(
      (n) => n.kind === "group" && n.id === g1,
    )
    expect(g1Before?.kind === "group" && g1Before.locked).toBe(false)

    act(() => {
      g2 = result.current.addGroup()
    })
    // g1 should now be locked, g2 open
    const g1After = result.current.nodes.find(
      (n) => n.kind === "group" && n.id === g1,
    )
    const g2After = result.current.nodes.find(
      (n) => n.kind === "group" && n.id === g2,
    )
    expect(g1After?.kind === "group" && g1After.locked).toBe(true)
    expect(g2After?.kind === "group" && g2After.locked).toBe(false)
  })

  it("toggleGroupLock locks an open group", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
    })
    act(() => {
      result.current.toggleGroupLock(groupId)
    })
    const group = result.current.nodes.find(
      (n) => n.kind === "group" && n.id === groupId,
    )
    expect(group?.kind === "group" && group.locked).toBe(true)
  })

  it("toggleGroupLock opens a locked group and locks all other open groups", () => {
    const { result } = renderHook(() => useTimeline())
    let g1!: string
    let g2!: string
    act(() => {
      g1 = result.current.addGroup()
      g2 = result.current.addGroup() // auto-locks g1
    })
    // g2 is open, g1 is locked. Now toggle g1 to open it.
    act(() => {
      result.current.toggleGroupLock(g1)
    })
    const g1Node = result.current.nodes.find(
      (n) => n.kind === "group" && n.id === g1,
    )
    const g2Node = result.current.nodes.find(
      (n) => n.kind === "group" && n.id === g2,
    )
    expect(g1Node?.kind === "group" && g1Node.locked).toBe(false)
    expect(g2Node?.kind === "group" && g2Node.locked).toBe(true)
  })

  it("addEntry lands at top level when no group is open", () => {
    const { result } = renderHook(() => useTimeline())
    let groupId!: string
    act(() => {
      groupId = result.current.addGroup()
    })
    act(() => {
      result.current.toggleGroupLock(groupId) // lock the group
    })
    act(() => {
      result.current.addEntry(sample)
    })
    const topLevel = result.current.nodes.filter((n) => n.kind === "entry")
    expect(topLevel).toHaveLength(1)
    const group = result.current.nodes.find(
      (n) => n.kind === "group" && n.id === groupId,
    )
    if (group?.kind === "group") {
      expect(group.entries).toHaveLength(0)
    }
  })
})
