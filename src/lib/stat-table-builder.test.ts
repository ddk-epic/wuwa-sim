import { describe, expect, it } from "vitest"
import type { BuffDef } from "#/types/buff"
import { emptyStatTable } from "#/types/stat-table"
import { accumulateStatEffects, freezeSnapshots } from "./stat-table-builder"

const baseBuff = (overrides: Partial<BuffDef>): BuffDef => ({
  id: "b",
  name: "B",
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  effects: [],
  ...overrides,
})

describe("accumulateStatEffects", () => {
  it("writes a const stat effect into the table", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    })
    accumulateStatEffects(stats, { def, stacks: 1 })
    expect(stats.atkPct).toBeCloseTo(0.2)
  })

  it("multiplies perStack values by stacks", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.05 },
        },
      ],
    })
    accumulateStatEffects(stats, { def, stacks: 3 })
    expect(stats.atkPct).toBeCloseTo(0.15)
  })

  it("uses snapshotted value when provided", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.05, snapshot: true },
        },
      ],
    })
    const snapshots = freezeSnapshots(def, 4)
    accumulateStatEffects(stats, { def, stacks: 1, snapshots })
    expect(stats.atkPct).toBeCloseTo(0.2)
  })

  it("ignores non-stat effects", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "resource",
          resource: "energy",
          op: "add",
          value: { kind: "const", v: 10 },
        },
      ],
    })
    accumulateStatEffects(stats, { def, stacks: 1 })
    expect(stats.atkPct).toBe(0)
  })

  it("writes into keyed stat paths", () => {
    const stats = emptyStatTable()
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    })
    accumulateStatEffects(stats, { def, stacks: 1 })
    expect(stats.elementBonus.Fusion).toBeCloseTo(0.3)
  })
})

describe("freezeSnapshots", () => {
  it("returns undefined when no effects request snapshotting", () => {
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    })
    expect(freezeSnapshots(def, 1)).toBeUndefined()
  })

  it("freezes perStack values multiplied by stacks at snapshot time", () => {
    const def = baseBuff({
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.05, snapshot: true },
        },
      ],
    })
    expect(freezeSnapshots(def, 4)).toEqual({ 0: 0.2 })
  })
})
