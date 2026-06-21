// @vitest-environment node
import { describe, expect, it } from "vitest"
import { applyDragPreview } from "./timeline-drag-preview"
import type { RenderItem } from "./timeline-render-items"
import type { DragPreviewState } from "./timeline-drag-preview"

function groupHeaderItem(
  groupId: string,
  opts: Partial<Extract<RenderItem, { type: "groupHeader" }>> = {},
): Extract<RenderItem, { type: "groupHeader" }> {
  return {
    type: "groupHeader",
    groupId,
    label: groupId,
    locked: false,
    entryCount: 0,
    startFlatIndex: 0,
    gradient: "",
    dominantHex: "#888",
    distinctCharIds: [],
    lastCharId: null,
    containerIndex: 0,
    ...opts,
  }
}

function groupEntryItem(
  id: string,
  groupId: string,
  containerIndex = 0,
): Extract<RenderItem, { type: "entry" }> {
  return entryItem(id, "#888", "Skill", {
    groupId,
    inGroup: true,
    containerIndex,
  })
}

function entryItem(
  id: string,
  charHex = "#888",
  skillName: string | null = "Skill",
  opts: Partial<Extract<RenderItem, { type: "entry" }>> = {},
): Extract<RenderItem, { type: "entry" }> {
  return {
    type: "entry",
    entry: { id, characterId: 1, stageId: "S::1", variantKind: undefined },
    flatIndex: 0,
    inGroup: false,
    groupId: null,
    groupLocked: false,
    isLastInGroup: false,
    lastInGroupGradient: null,
    groupFirstCharHex: null,
    charName: "Test",
    charHex,
    elementLetter: "T",
    skillType: null,
    damageType: null,
    skillName,
    stageWithVariants: null,
    isInvalid: false,
    errors: [],
    warnings: [],
    showMessage: false,
    containerIndex: 0,
    ...opts,
  }
}

const noState: DragPreviewState = { draggedId: null, dropTarget: null }

describe("applyDragPreview — no-op cases", () => {
  it("returns items unchanged when no drag is active", () => {
    const items: RenderItem[] = [entryItem("a"), entryItem("b")]
    expect(applyDragPreview(items, noState)).toBe(items)
  })

  it("returns items unchanged when drag has no drop target", () => {
    const items: RenderItem[] = [entryItem("a"), entryItem("b")]
    expect(applyDragPreview(items, { draggedId: "a", dropTarget: null })).toBe(
      items,
    )
  })

  it("returns items unchanged when drop target is a group header", () => {
    const items: RenderItem[] = [entryItem("a"), entryItem("b")]
    expect(
      applyDragPreview(items, {
        draggedId: "a",
        dropTarget: { id: "group:g1", position: "above" },
      }),
    ).toBe(items)
  })

  it("returns items unchanged when draggedId is not found (group source)", () => {
    const items: RenderItem[] = [entryItem("a"), entryItem("b")]
    expect(
      applyDragPreview(items, {
        draggedId: "some-group-id",
        dropTarget: { id: "a", position: "above" },
      }),
    ).toBe(items)
  })

  it("returns items unchanged when target entry is not found", () => {
    const items: RenderItem[] = [entryItem("a"), entryItem("b")]
    expect(
      applyDragPreview(items, {
        draggedId: "a",
        dropTarget: { id: "unknown", position: "above" },
      }),
    ).toBe(items)
  })
})

describe("applyDragPreview — ghost insertion above", () => {
  it("inserts ghost before target and hides source (source before target)", () => {
    const a = entryItem("a", "#f00", "Alpha", { containerIndex: 0 })
    const b = entryItem("b", "#0f0", "Beta", { containerIndex: 1 })
    const c = entryItem("c", "#00f", "Gamma", { containerIndex: 2 })
    const state: DragPreviewState = {
      draggedId: "a",
      dropTarget: { id: "c", position: "above" },
    }
    const result = applyDragPreview([a, b, c], state)

    expect(result).toHaveLength(4) // 3 items + ghost
    expect(result[0]).toMatchObject({
      type: "entry",
      entry: { id: "a" },
      hidden: true,
    })
    expect(result[1]).toMatchObject({ type: "entry", entry: { id: "b" } })
    expect(result[2]).toMatchObject({
      type: "ghost",
      sourceId: "a",
      charHex: "#f00",
      skillName: "Alpha",
    })
    expect(result[3]).toMatchObject({ type: "entry", entry: { id: "c" } })
  })

  it("inserts ghost before target and hides source (source after target)", () => {
    const a = entryItem("a", "#f00", "Alpha", { containerIndex: 0 })
    const b = entryItem("b", "#0f0", "Beta", { containerIndex: 1 })
    const c = entryItem("c", "#00f", "Gamma", { containerIndex: 2 })
    const state: DragPreviewState = {
      draggedId: "c",
      dropTarget: { id: "a", position: "above" },
    }
    const result = applyDragPreview([a, b, c], state)

    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({
      type: "ghost",
      sourceId: "c",
      charHex: "#00f",
    })
    expect(result[1]).toMatchObject({ type: "entry", entry: { id: "a" } })
    expect(result[2]).toMatchObject({ type: "entry", entry: { id: "b" } })
    expect(result[3]).toMatchObject({
      type: "entry",
      entry: { id: "c" },
      hidden: true,
    })
  })
})

describe("applyDragPreview — ghost insertion below", () => {
  it("inserts ghost after target and hides source (source before target)", () => {
    const a = entryItem("a", "#f00", "Alpha", { containerIndex: 0 })
    const b = entryItem("b", "#0f0", "Beta", { containerIndex: 1 })
    const c = entryItem("c", "#00f", "Gamma", { containerIndex: 2 })
    const state: DragPreviewState = {
      draggedId: "a",
      dropTarget: { id: "b", position: "below" },
    }
    const result = applyDragPreview([a, b, c], state)

    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({
      type: "entry",
      entry: { id: "a" },
      hidden: true,
    })
    expect(result[1]).toMatchObject({ type: "entry", entry: { id: "b" } })
    expect(result[2]).toMatchObject({
      type: "ghost",
      sourceId: "a",
      charHex: "#f00",
    })
    expect(result[3]).toMatchObject({ type: "entry", entry: { id: "c" } })
  })

  it("inserts ghost after target and hides source (source after target)", () => {
    const a = entryItem("a", "#f00", "Alpha", { containerIndex: 0 })
    const b = entryItem("b", "#0f0", "Beta", { containerIndex: 1 })
    const c = entryItem("c", "#00f", "Gamma", { containerIndex: 2 })
    const state: DragPreviewState = {
      draggedId: "c",
      dropTarget: { id: "a", position: "below" },
    }
    const result = applyDragPreview([a, b, c], state)

    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({ type: "entry", entry: { id: "a" } })
    expect(result[1]).toMatchObject({
      type: "ghost",
      sourceId: "c",
      charHex: "#00f",
    })
    expect(result[2]).toMatchObject({ type: "entry", entry: { id: "b" } })
    expect(result[3]).toMatchObject({
      type: "entry",
      entry: { id: "c" },
      hidden: true,
    })
  })
})

describe("applyDragPreview — ghost carries source metadata", () => {
  it("ghost has correct charHex and skillName from source", () => {
    const src = entryItem("src", "#abcdef", "MySkill")
    const tgt = entryItem("tgt", "#ffffff", "Other")
    const state: DragPreviewState = {
      draggedId: "src",
      dropTarget: { id: "tgt", position: "above" },
    }
    const result = applyDragPreview([src, tgt], state)
    const ghost = result.find((r) => r.type === "ghost")
    expect(ghost).toMatchObject({
      type: "ghost",
      sourceId: "src",
      charHex: "#abcdef",
      skillName: "MySkill",
    })
  })

  it("ghost carries null skillName when source has none", () => {
    const src = entryItem("src", "#888", null)
    const tgt = entryItem("tgt")
    const state: DragPreviewState = {
      draggedId: "src",
      dropTarget: { id: "tgt", position: "above" },
    }
    const result = applyDragPreview([src, tgt], state)
    const ghost = result.find((r) => r.type === "ghost")
    expect(ghost).toMatchObject({ type: "ghost", skillName: null })
  })
})

describe("applyDragPreview — group source: no-op cases", () => {
  it("returns items unchanged when source group not found", () => {
    const items: RenderItem[] = [groupHeaderItem("g1"), entryItem("e1")]
    expect(
      applyDragPreview(items, {
        draggedId: "unknown",
        dropTarget: { id: "group:g1", position: "above" },
      }),
    ).toBe(items)
  })
})

describe("applyDragPreview — group source: ghost inserted at group target", () => {
  it("above a group: ghost inserted before target group header, source hidden", () => {
    // items: [g1 header, g1-e1, g2 header, g2-e1]
    const g1 = groupHeaderItem("g1", {
      entryCount: 1,
      label: "Group 1",
      dominantHex: "#f00",
      containerIndex: 0,
    })
    const g1e1 = groupEntryItem("g1e1", "g1", 0)
    const g2 = groupHeaderItem("g2", {
      entryCount: 1,
      label: "Group 2",
      dominantHex: "#0f0",
      containerIndex: 1,
    })
    const g2e1 = groupEntryItem("g2e1", "g2", 0)
    const items: RenderItem[] = [g1, g1e1, g2, g2e1]

    const result = applyDragPreview(items, {
      draggedId: "g1",
      dropTarget: { id: "group:g2", position: "above" },
    })

    expect(result).toHaveLength(5)
    expect(result[0]).toMatchObject({
      type: "groupHeader",
      groupId: "g1",
      hidden: true,
    })
    expect(result[1]).toMatchObject({
      type: "entry",
      entry: { id: "g1e1" },
      hidden: true,
    })
    expect(result[2]).toMatchObject({
      type: "groupGhost",
      sourceGroupId: "g1",
      label: "Group 1",
    })
    expect(result[3]).toMatchObject({ type: "groupHeader", groupId: "g2" })
    expect(result[4]).toMatchObject({ type: "entry", entry: { id: "g2e1" } })
  })

  it("below a group: ghost inserted after last entry of target group", () => {
    const g1 = groupHeaderItem("g1", {
      entryCount: 1,
      label: "G1",
      dominantHex: "#f00",
      containerIndex: 0,
    })
    const g1e1 = groupEntryItem("g1e1", "g1", 0)
    const g2 = groupHeaderItem("g2", {
      entryCount: 2,
      label: "G2",
      dominantHex: "#0f0",
      containerIndex: 1,
    })
    const g2e1 = groupEntryItem("g2e1", "g2", 0)
    const g2e2 = groupEntryItem("g2e2", "g2", 1)
    const items: RenderItem[] = [g1, g1e1, g2, g2e1, g2e2]

    const result = applyDragPreview(items, {
      draggedId: "g1",
      dropTarget: { id: "group:g2", position: "below" },
    })

    expect(result).toHaveLength(6)
    expect(result[0]).toMatchObject({
      type: "groupHeader",
      groupId: "g1",
      hidden: true,
    })
    expect(result[1]).toMatchObject({
      type: "entry",
      entry: { id: "g1e1" },
      hidden: true,
    })
    expect(result[2]).toMatchObject({ type: "groupHeader", groupId: "g2" })
    expect(result[3]).toMatchObject({ type: "entry", entry: { id: "g2e1" } })
    expect(result[4]).toMatchObject({ type: "entry", entry: { id: "g2e2" } })
    expect(result[5]).toMatchObject({ type: "groupGhost", sourceGroupId: "g1" })
  })
})

describe("applyDragPreview — group source: ghost inserted at entry target", () => {
  it("above a top-level entry: ghost inserted before that entry", () => {
    const g1 = groupHeaderItem("g1", {
      entryCount: 1,
      label: "G1",
      dominantHex: "#f00",
      containerIndex: 0,
    })
    const g1e1 = groupEntryItem("g1e1", "g1", 0)
    const e1 = entryItem("e1", "#00f", "Skill", { containerIndex: 1 })
    const items: RenderItem[] = [g1, g1e1, e1]

    const result = applyDragPreview(items, {
      draggedId: "g1",
      dropTarget: { id: "e1", position: "above" },
    })

    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({
      type: "groupHeader",
      groupId: "g1",
      hidden: true,
    })
    expect(result[1]).toMatchObject({
      type: "entry",
      entry: { id: "g1e1" },
      hidden: true,
    })
    expect(result[2]).toMatchObject({ type: "groupGhost", sourceGroupId: "g1" })
    expect(result[3]).toMatchObject({ type: "entry", entry: { id: "e1" } })
  })

  it("below a top-level entry: ghost inserted after that entry", () => {
    const e1 = entryItem("e1", "#00f", "Skill", { containerIndex: 0 })
    const g1 = groupHeaderItem("g1", {
      entryCount: 1,
      label: "G1",
      dominantHex: "#f00",
      containerIndex: 1,
    })
    const g1e1 = groupEntryItem("g1e1", "g1", 0)
    const items: RenderItem[] = [e1, g1, g1e1]

    const result = applyDragPreview(items, {
      draggedId: "g1",
      dropTarget: { id: "e1", position: "below" },
    })

    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({ type: "entry", entry: { id: "e1" } })
    expect(result[1]).toMatchObject({ type: "groupGhost", sourceGroupId: "g1" })
    expect(result[2]).toMatchObject({
      type: "groupHeader",
      groupId: "g1",
      hidden: true,
    })
    expect(result[3]).toMatchObject({
      type: "entry",
      entry: { id: "g1e1" },
      hidden: true,
    })
  })
})

describe("applyDragPreview — group ghost carries source metadata", () => {
  it("groupGhost has label, entryCount, dominantHex from source group", () => {
    const g1 = groupHeaderItem("g1", {
      label: "MyGroup",
      entryCount: 3,
      dominantHex: "#abc123",
      containerIndex: 0,
    })
    const g2 = groupHeaderItem("g2", { containerIndex: 1 })
    const items: RenderItem[] = [g1, g2]

    const result = applyDragPreview(items, {
      draggedId: "g1",
      dropTarget: { id: "group:g2", position: "above" },
    })

    const groupGhost = result.find((r) => r.type === "groupGhost")
    expect(groupGhost).toMatchObject({
      type: "groupGhost",
      sourceGroupId: "g1",
      label: "MyGroup",
      entryCount: 3,
      dominantHex: "#abc123",
    })
  })
})
