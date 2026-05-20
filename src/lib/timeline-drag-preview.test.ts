import { describe, expect, it } from "vitest"
import { applyDragPreview } from "./timeline-drag-preview"
import type { RenderItem } from "./timeline-render-items"
import type { DragPreviewState } from "./timeline-drag-preview"

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
