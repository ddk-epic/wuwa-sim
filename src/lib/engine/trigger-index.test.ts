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

  const stepDef = (
    resource: string,
    direction: "consumed" | "gained",
    step: number,
  ): BuffDef => ({
    id: `step.${resource}.${direction}.${step}`,
    name: "step",
    trigger: {
      event: "resourceStep",
      resource: resource as "forte",
      direction,
      step,
    },
    target: { kind: "self" },
    duration: { kind: "seconds", v: 15 },
    effects: [],
  })

  it("resourceStep consumed: full 100→0 drain fires every multiple of step", () => {
    const idx = new TriggerIndex([stepDef("forte", "consumed", 10)])
    expect(idx.crossedThresholds("forte", "down", 100, 0)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90,
    ])
  })

  it("resourceStep consumed: single boundary 100→90 mints one (m=90)", () => {
    const idx = new TriggerIndex([stepDef("forte", "consumed", 10)])
    expect(idx.crossedThresholds("forte", "down", 100, 90)).toEqual([90])
  })

  it("resourceStep consumed: multi-cross in one delta with carryover", () => {
    const idx = new TriggerIndex([stepDef("forte", "consumed", 10)])
    // 93.8 → 88.5 crosses only 90; 88.5 → 70 crosses 80 and 70.
    expect(idx.crossedThresholds("forte", "down", 93.8, 88.5)).toEqual([90])
    expect(idx.crossedThresholds("forte", "down", 88.5, 70)).toEqual([70, 80])
  })

  it("resourceStep consumed: never fires on a gain (up)", () => {
    const idx = new TriggerIndex([stepDef("forte", "consumed", 10)])
    expect(idx.crossedThresholds("forte", "up", 0, 100)).toEqual([])
  })

  it("resourceStep gained: fires every multiple on an upward refill", () => {
    const idx = new TriggerIndex([stepDef("forte", "gained", 10)])
    expect(idx.crossedThresholds("forte", "up", 0, 100)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ])
  })

  it("resourceStep and explicit resourceCrossed coexist on the same key", () => {
    const idx = new TriggerIndex([
      stepDef("forte", "consumed", 10),
      rcDef("forte", "down", 0),
    ])
    // Step multiples 0..90 plus the explicit 0 (deduped).
    expect(idx.crossedThresholds("forte", "down", 100, 0)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90,
    ])
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
