// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { TimelineNode } from "#/types/timeline"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { Diagnostic } from "#/types/simulation-log"
import type { ValidationResult } from "./validate-timeline"
import type { ResolvedStage } from "../stage"
import { buildTimelineRenderItems } from "./timeline-render-items"
import { makeResolvedStage } from "../stage.test-utils"

let testCharacters: EnrichedCharacter[] = []
let resolvedStages: Map<string, ResolvedStage | null> = new Map()

vi.mock("../loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
}))

vi.mock("#/lib/compile-character", () => ({
  findStageByEntry: (entry: { stageId: string }) =>
    resolvedStages.get(entry.stageId) ?? null,
  buildStageLabels: () => new Map<string, string>(),
}))

afterEach(() => {
  testCharacters = []
  resolvedStages = new Map()
})

const topEntry = (
  id: string,
  characterId = 1,
  stageId = "s1",
): TimelineNode => ({
  kind: "entry",
  id,
  characterId,
  stageId,
})

const group = (
  id: string,
  entryIds: string[],
  locked = false,
): Extract<TimelineNode, { kind: "group" }> => ({
  kind: "group",
  id,
  label: `Group ${id}`,
  locked,
  entries: entryIds.map((eid) => ({ id: eid, characterId: 1, stageId: "s1" })),
})

const slots: Slots = [1, 2, 3]
const loadouts: SlotLoadout[] = []
const emptyValidation = (): ValidationResult => ({
  findings: new Map(),
  invalidRowIds: new Set(),
})

const call = (
  nodes: TimelineNode[],
  expandedGroupIds: Set<string> = new Set(),
  validation: ValidationResult = emptyValidation(),
  logWarnings: Map<string, Diagnostic[]> = new Map(),
) =>
  buildTimelineRenderItems(
    nodes,
    expandedGroupIds,
    slots,
    loadouts,
    validation,
    logWarnings,
  )

const entryItems = (items: ReturnType<typeof call>) =>
  items.filter(
    (i): i is Extract<(typeof items)[number], { type: "entry" }> =>
      i.type === "entry",
  )

describe("buildTimelineRenderItems", () => {
  it("returns single entry item for ungrouped node", () => {
    const items = call([topEntry("e1")])
    expect(items).toHaveLength(1)
    const item = items[0]
    expect(item.type).toBe("entry")
    if (item.type === "entry") {
      expect(item.entry.id).toBe("e1")
      expect(item.flatIndex).toBe(0)
      expect(item.inGroup).toBe(false)
      expect(item.groupId).toBeNull()
      expect(item.groupLocked).toBe(false)
      expect(item.isLastInGroup).toBe(false)
      expect(item.lastInGroupGradient).toBeNull()
      expect(item.groupFirstCharHex).toBeNull()
    }
  })

  it("expanded group entries have correct inGroup and groupId", () => {
    const g = group("g1", ["e1", "e2"])
    const entries = entryItems(call([g], new Set(["g1"])))
    expect(entries[0].inGroup).toBe(true)
    expect(entries[0].groupId).toBe("g1")
    expect(entries[1].inGroup).toBe(true)
    expect(entries[1].isLastInGroup).toBe(true)
    expect(entries[0].isLastInGroup).toBe(false)
  })

  it("collapsed group emits only groupHeader and skips flatIndex", () => {
    const g = group("g1", ["e1", "e2", "e3"])
    const items = call([g, topEntry("e4")])
    expect(items).toHaveLength(2)
    expect(items[0].type).toBe("groupHeader")
    const e = items[1]
    if (e.type !== "entry") throw new Error("expected entry render item")
    expect(e.flatIndex).toBe(3)
  })

  it("mixed nodes: ungrouped then group then ungrouped", () => {
    const g = group("g1", ["e2", "e3"])
    const nodes: TimelineNode[] = [topEntry("e1"), g, topEntry("e4")]
    const items = call(nodes, new Set(["g1"]))
    // e1, groupHeader, e2, e3, e4
    expect(items).toHaveLength(5)
    expect(entryItems(items).map((i) => i.flatIndex)).toEqual([0, 1, 2, 3])
  })

  it("locked group propagates groupLocked to entries", () => {
    const g = group("g1", ["e1", "e2"], true)
    const entries = entryItems(call([g], new Set(["g1"])))
    expect(entries.every((e) => e.groupLocked)).toBe(true)
  })

  it("damageType comes from damage[0].type", () => {
    const stage = makeResolvedStage({
      stageId: "s1",
      skillType: "Resonance Skill",
      damage: [{ type: "Heavy Attack" } as ResolvedStage["damage"][number]],
    })
    resolvedStages.set("s1", stage)
    const items = call([topEntry("e1", 1, "s1")])
    expect(entryItems(items)[0].damageType).toBe("Heavy Attack")
  })

  it("damageType falls back to skillType when stage has no damage", () => {
    const stage = makeResolvedStage({
      stageId: "s1",
      skillType: "Resonance Liberation",
      damage: [],
    })
    resolvedStages.set("s1", stage)
    const items = call([topEntry("e1", 1, "s1")])
    expect(entryItems(items)[0].damageType).toBe("Resonance Liberation")
  })

  it("stageWithVariants is set when stage has variants", () => {
    const stage = makeResolvedStage({
      stage: { actionTime: 30, variants: { cancel: { actionTime: 20 } } },
      stageId: "s1",
    })
    resolvedStages.set("s1", stage)
    const items = call([topEntry("e1", 1, "s1")])
    expect(entryItems(items)[0].stageWithVariants).not.toBeNull()
  })

  // Findings → rendered messages
  it("renders an invalid finding into errors and a warning finding into warnings", () => {
    const validation: ValidationResult = {
      findings: new Map([
        [
          "e1",
          [
            { message: { kind: "characterNotInTeam" }, severity: "invalid" },
            {
              message: { kind: "swapForcesDifferentChar" },
              severity: "warning",
            },
          ],
        ],
      ]),
      invalidRowIds: new Set(["e1"]),
    }
    const e = entryItems(call([topEntry("e1")], new Set(), validation))[0]
    expect(e.isInvalid).toBe(true)
    expect(e.errors).toEqual([{ message: "Character is not in the team" }])
    expect(e.warnings).toEqual([
      { message: "Swap forces the next entry to be a different character" },
    ])
    expect(e.showMessage).toBe(true)
  })

  it("merges engine Diagnostics into the warning channel", () => {
    const logWarnings = new Map<string, Diagnostic[]>([
      ["e1", [{ kind: "footingViolation", isLand: false }]],
    ])
    const e = entryItems(
      call([topEntry("e1")], new Set(), emptyValidation(), logWarnings),
    )[0]
    expect(e.warnings).toEqual([
      { message: "Launch/Jump required before an aerial stage" },
    ])
    expect(e.isInvalid).toBe(false)
    expect(e.errors).toEqual([])
    expect(e.showMessage).toBe(true)
  })

  // Loop Marker
  it("emits an openerHeader and a loopMarker, leaving entry flatIndexes unbroken", () => {
    const marker: TimelineNode = { kind: "loopMarker", id: "m1" }
    const items = call([topEntry("e1"), marker, topEntry("e2")])
    expect(items.map((i) => i.type)).toEqual([
      "openerHeader",
      "entry",
      "loopMarker",
      "entry",
    ])
    expect(entryItems(items).map((i) => i.flatIndex)).toEqual([0, 1])
  })

  it("routes an invalid-severity Diagnostic into errors and reddens the row", () => {
    const logWarnings = new Map<string, Diagnostic[]>([
      [
        "e1",
        [
          {
            kind: "skillOnCooldown",
            actor: "Char1",
            remaining: 140,
            severity: "invalid",
          },
        ],
      ],
    ])
    const e = entryItems(
      call([topEntry("e1")], new Set(), emptyValidation(), logWarnings),
    )[0]
    expect(e.isInvalid).toBe(true)
    expect(e.errors).toEqual([
      { message: "Skill on cooldown for 140 more frames" },
    ])
    expect(e.warnings).toEqual([])
  })
})
