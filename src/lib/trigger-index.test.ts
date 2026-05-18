import { describe, expect, it } from "vitest"
import type { BuffDef } from "#/types/buff"
import { TriggerIndex } from "./trigger-index"

const rcDef = (
  resource: string,
  direction: "up" | "down",
  threshold: number,
): BuffDef => ({
  id: `rc.${resource}.${direction}.${threshold}`,
  name: "rc",
  trigger: {
    event: "resourceCrossed",
    resource: resource as "energy",
    direction,
    threshold,
  },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  effects: [],
})

describe("TriggerIndex", () => {
  it("empty input returns empty for any query", () => {
    const idx = new TriggerIndex([])
    expect(idx.crossedThresholds("energy", "up", 0, 100)).toEqual([])
  })

  it("equal before === after returns empty", () => {
    const idx = new TriggerIndex([rcDef("energy", "up", 50)])
    expect(idx.crossedThresholds("energy", "up", 50, 50)).toEqual([])
  })

  it("transition that crosses none returns empty", () => {
    const idx = new TriggerIndex([rcDef("energy", "up", 100)])
    expect(idx.crossedThresholds("energy", "up", 0, 50)).toEqual([])
  })

  it("single threshold — up: crossed when before < threshold <= after", () => {
    const idx = new TriggerIndex([rcDef("energy", "up", 50)])
    expect(idx.crossedThresholds("energy", "up", 0, 50)).toEqual([50])
    expect(idx.crossedThresholds("energy", "up", 50, 100)).toEqual([])
    expect(idx.crossedThresholds("energy", "up", 49, 50)).toEqual([50])
  })

  it("single threshold — down: crossed when after <= threshold < before", () => {
    const idx = new TriggerIndex([rcDef("energy", "down", 50)])
    expect(idx.crossedThresholds("energy", "down", 100, 50)).toEqual([50])
    expect(idx.crossedThresholds("energy", "down", 50, 0)).toEqual([])
    expect(idx.crossedThresholds("energy", "down", 51, 50)).toEqual([50])
  })

  it("multiple thresholds — returns all crossed in ascending order", () => {
    const idx = new TriggerIndex([
      rcDef("energy", "up", 75),
      rcDef("energy", "up", 25),
      rcDef("energy", "up", 50),
    ])
    expect(idx.crossedThresholds("energy", "up", 0, 100)).toEqual([25, 50, 75])
    expect(idx.crossedThresholds("energy", "up", 30, 80)).toEqual([50, 75])
  })

  it("duplicate thresholds from different defs are deduplicated", () => {
    const idx = new TriggerIndex([
      rcDef("energy", "up", 50),
      rcDef("energy", "up", 50),
    ])
    expect(idx.crossedThresholds("energy", "up", 0, 100)).toEqual([50])
  })

  it("up and down direction are bucketed separately", () => {
    const idx = new TriggerIndex([
      rcDef("energy", "up", 50),
      rcDef("energy", "down", 50),
    ])
    expect(idx.crossedThresholds("energy", "up", 0, 100)).toEqual([50])
    expect(idx.crossedThresholds("energy", "down", 0, 100)).toEqual([])
    expect(idx.crossedThresholds("energy", "down", 100, 0)).toEqual([50])
  })

  it("different resources are bucketed separately", () => {
    const idx = new TriggerIndex([
      rcDef("energy", "up", 50),
      rcDef("concerto", "up", 30),
    ])
    expect(idx.crossedThresholds("energy", "up", 0, 100)).toEqual([50])
    expect(idx.crossedThresholds("concerto", "up", 0, 100)).toEqual([30])
    expect(idx.crossedThresholds("forte", "up", 0, 100)).toEqual([])
  })

  it("non-resourceCrossed triggers are ignored", () => {
    const simStartDef: BuffDef = {
      id: "simstart",
      name: "s",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [],
    }
    const idx = new TriggerIndex([simStartDef, rcDef("energy", "up", 50)])
    expect(idx.crossedThresholds("energy", "up", 0, 100)).toEqual([50])
  })
})
