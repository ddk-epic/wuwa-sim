import { describe, expect, it } from "vitest"
import type { ActionTimeStage } from "#/lib/stage"
import { nextVariant, variantLabel } from "./TimelineEntryRow"

const stageAllVariants: ActionTimeStage = {
  actionTime: 50,
  variants: {
    cancel: { actionTime: 33 },
    instantCancel: { actionTime: 7 },
    swap: { actionTime: 10 },
  },
}

const stageCancelOnly: ActionTimeStage = {
  actionTime: 50,
  variants: { cancel: { actionTime: 33 } },
}

const stageSwapOnly: ActionTimeStage = {
  actionTime: 50,
  variants: { swap: { actionTime: 10 } },
}

const stageNoVariants: ActionTimeStage = {
  actionTime: 50,
}

describe("nextVariant — full cycle", () => {
  it("cycles FULL → CNCL → INST → SWAP → FULL when all variants present", () => {
    expect(nextVariant(undefined, stageAllVariants)).toBe("cancel")
    expect(nextVariant("cancel", stageAllVariants)).toBe("instantCancel")
    expect(nextVariant("instantCancel", stageAllVariants)).toBe("swap")
    expect(nextVariant("swap", stageAllVariants)).toBeUndefined()
  })

  it("skips undefined variants: cancel-only cycles FULL → CNCL → FULL", () => {
    expect(nextVariant(undefined, stageCancelOnly)).toBe("cancel")
    expect(nextVariant("cancel", stageCancelOnly)).toBeUndefined()
  })

  it("skips undefined variants: swap-only cycles FULL → SWAP → FULL", () => {
    expect(nextVariant(undefined, stageSwapOnly)).toBe("swap")
    expect(nextVariant("swap", stageSwapOnly)).toBeUndefined()
  })

  it("stage with no variants stays at FULL (only undefined in defined list)", () => {
    expect(nextVariant(undefined, stageNoVariants)).toBeUndefined()
  })
})

describe("variantLabel", () => {
  it("returns FULL for undefined", () => {
    expect(variantLabel(undefined)).toBe("FULL")
  })
  it("returns CNCL for cancel", () => {
    expect(variantLabel("cancel")).toBe("CNCL")
  })
  it("returns INST for instantCancel", () => {
    expect(variantLabel("instantCancel")).toBe("INST")
  })
  it("returns SWAP for swap", () => {
    expect(variantLabel("swap")).toBe("SWAP")
  })
})
