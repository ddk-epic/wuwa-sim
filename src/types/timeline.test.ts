// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { TimelineNode } from "./timeline"
import { flattenNodes, splitRotations } from "./timeline"

const entry = (id: string): TimelineNode => ({
  kind: "entry",
  id,
  characterId: 1,
  stageId: "s1",
})

const group = (id: string, entryIds: string[]): TimelineNode => ({
  kind: "group",
  id,
  label: "",
  locked: false,
  entries: entryIds.map((eid) => ({ id: eid, characterId: 1, stageId: "s1" })),
})

const marker = (id = "m"): TimelineNode => ({ kind: "loopMarker", id })

describe("flattenNodes", () => {
  it("strips the loop marker from the flat entry list", () => {
    const nodes = [entry("e1"), marker(), entry("e2")]
    expect(flattenNodes(nodes).map((e) => e.id)).toEqual(["e1", "e2"])
  })

  it("the flat entry list the engine sees is identical with or without a marker", () => {
    const without = [entry("e1"), group("g1", ["e2", "e3"]), entry("e4")]
    const withMarker = [
      entry("e1"),
      marker(),
      group("g1", ["e2", "e3"]),
      entry("e4"),
    ]
    expect(flattenNodes(withMarker)).toEqual(flattenNodes(without))
  })
})

describe("splitRotations", () => {
  it("returns all entries as opener when no marker is present", () => {
    const nodes = [entry("e1"), group("g1", ["e2", "e3"])]
    const { opener, loop } = splitRotations(nodes)
    expect(opener.map((e) => e.id)).toEqual(["e1", "e2", "e3"])
    expect(loop).toEqual([])
  })

  it("cuts at the marker into opener and loop", () => {
    const nodes = [entry("e1"), marker(), entry("e2"), entry("e3")]
    const { opener, loop } = splitRotations(nodes)
    expect(opener.map((e) => e.id)).toEqual(["e1"])
    expect(loop.map((e) => e.id)).toEqual(["e2", "e3"])
  })

  it("flattens groups within each rotation", () => {
    const nodes = [group("g1", ["e1"]), marker(), group("g2", ["e2", "e3"])]
    const { opener, loop } = splitRotations(nodes)
    expect(opener.map((e) => e.id)).toEqual(["e1"])
    expect(loop.map((e) => e.id)).toEqual(["e2", "e3"])
  })

  it("yields an empty loop when the marker is last", () => {
    const { opener, loop } = splitRotations([entry("e1"), marker()])
    expect(opener.map((e) => e.id)).toEqual(["e1"])
    expect(loop).toEqual([])
  })
})
