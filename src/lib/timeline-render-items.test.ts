import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { TimelineNode } from "#/types/timeline"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { ValidationResult } from "./validate-timeline"
import type { ResolvedStage } from "./stage/stage"
import { buildTimelineRenderItems } from "./timeline-render-items"

let testCharacters: EnrichedCharacter[] = []
let resolvedStages: Map<string, ResolvedStage | null> = new Map()

vi.mock("./catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
}))

vi.mock("./stage/stage", () => ({
  findStageByEntry: (entry: { stageId: string }) =>
    resolvedStages.get(entry.stageId) ?? null,
}))

afterEach(() => {
  testCharacters = []
  resolvedStages = new Map()
})

const makeChar = (id: number, element: string): EnrichedCharacter =>
  ({
    id,
    name: `Char${id}`,
    element,
    weaponType: "Sword",
    rarity: "5",
    stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 0, def: 0 } },
    template: { weapon: "", echo: "", echoSet: "" },
    skillTreeBonuses: [],
    buffs: [],
    skills: [],
  }) as EnrichedCharacter

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
  rowErrors: new Map(),
  rowWarnings: new Map(),
  invalidRowIds: new Set(),
})

const call = (
  nodes: TimelineNode[],
  expandedGroupIds: Set<string> = new Set(),
  validation: ValidationResult = emptyValidation(),
) =>
  buildTimelineRenderItems(nodes, expandedGroupIds, slots, loadouts, validation)

const entryItems = (items: ReturnType<typeof call>) =>
  items.filter(
    (i): i is Extract<(typeof items)[number], { type: "entry" }> =>
      i.type === "entry",
  )

describe("buildTimelineRenderItems", () => {
  it("returns empty array for no nodes", () => {
    expect(call([])).toEqual([])
  })

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

  it("assigns sequential flatIndexes to multiple ungrouped entries", () => {
    const items = call([topEntry("e1"), topEntry("e2"), topEntry("e3")])
    expect(items).toHaveLength(3)
    expect(items.map((i) => i.type)).toEqual(["entry", "entry", "entry"])
    expect(entryItems(items).map((i) => i.flatIndex)).toEqual([0, 1, 2])
  })

  it("emits groupHeader + entry items for expanded group", () => {
    const g = group("g1", ["e1", "e2"])
    const items = call([g], new Set(["g1"]))
    expect(items).toHaveLength(3)
    expect(items[0].type).toBe("groupHeader")
    expect(items[1].type).toBe("entry")
    expect(items[2].type).toBe("entry")
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
    expect(items[1].type).toBe("entry")
    const e = items[1] as Extract<(typeof items)[number], { type: "entry" }>
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

  it("groupHeader carries pre-computed dominantHex and distinctCharIds", () => {
    testCharacters = [makeChar(1, "Fusion")]
    const g = group("g1", ["e1"])
    const items = call([g], new Set(["g1"]))
    const header = items[0]
    expect(header.type).toBe("groupHeader")
    if (header.type === "groupHeader") {
      expect(typeof header.dominantHex).toBe("string")
      expect(header.distinctCharIds).toContain(1)
    }
  })

  it("groupHeader gradient is pre-computed", () => {
    testCharacters = [makeChar(1, "Fusion")]
    const g = group("g1", ["e1"])
    const items = call([g])
    const header = items[0]
    expect(header.type).toBe("groupHeader")
    if (header.type === "groupHeader") {
      expect(header.gradient).toContain("linear-gradient")
    }
  })

  it("locked group propagates groupLocked to entries", () => {
    const g = group("g1", ["e1", "e2"], true)
    const entries = entryItems(call([g], new Set(["g1"])))
    expect(entries.every((e) => e.groupLocked)).toBe(true)
  })

  it("lastInGroupGradient is set only on the last entry of an expanded group", () => {
    testCharacters = [makeChar(1, "Fusion")]
    const g = group("g1", ["e1", "e2", "e3"])
    const entries = entryItems(call([g], new Set(["g1"])))
    expect(entries[0].lastInGroupGradient).toBeNull()
    expect(entries[1].lastInGroupGradient).toBeNull()
    expect(entries[2].lastInGroupGradient).not.toBeNull()
  })

  // Character resolution
  it("resolves charName from catalog", () => {
    testCharacters = [makeChar(1, "Fusion")]
    const items = call([topEntry("e1", 1)])
    expect(entryItems(items)[0].charName).toBe("Char1")
  })

  it("charName falls back to '—' when character not found", () => {
    const items = call([topEntry("e1", 99)])
    expect(entryItems(items)[0].charName).toBe("—")
  })

  it("resolves charHex from character element", () => {
    testCharacters = [makeChar(1, "Fusion")]
    const items = call([topEntry("e1", 1)])
    const hex = entryItems(items)[0].charHex
    expect(hex).not.toBe("#888")
    expect(hex).toMatch(/^#/)
  })

  it("charHex falls back to #888 when character not found", () => {
    const items = call([topEntry("e1", 99)])
    expect(entryItems(items)[0].charHex).toBe("#888")
  })

  it("elementLetter is first letter of element", () => {
    testCharacters = [makeChar(1, "Glacio")]
    const items = call([topEntry("e1", 1)])
    expect(entryItems(items)[0].elementLetter).toBe("G")
  })

  it("elementLetter falls back to '?' when character not found", () => {
    const items = call([topEntry("e1", 99)])
    expect(entryItems(items)[0].elementLetter).toBe("?")
  })

  // Stage resolution
  it("resolves skillType and skillName from stage", () => {
    const stage = {
      stage: { actionTime: 30 },
      stageId: "s1",
      stageName: "Test",
      element: "Fusion",
      concerto: 0,
      damage: [],
      skillType: "Basic Attack" as const,
      skillName: "Heavy Attack",
    } as ResolvedStage
    resolvedStages.set("s1", stage)
    const items = call([topEntry("e1", 1, "s1")])
    const e = entryItems(items)[0]
    expect(e.skillType).toBe("Basic Attack")
    expect(e.skillName).toBe("Heavy Attack")
  })

  it("skillType and skillName are null when stage not resolved", () => {
    resolvedStages.set("s1", null)
    const items = call([topEntry("e1", 1, "s1")])
    const e = entryItems(items)[0]
    expect(e.skillType).toBeNull()
    expect(e.skillName).toBeNull()
  })

  it("stageWithVariants is set when stage has variants", () => {
    const stage = {
      stage: {
        actionTime: 30,
        variants: { cancel: { actionTime: 20 } },
      },
      stageId: "s1",
      stageName: "Test",
      element: "Fusion",
      concerto: 0,
      damage: [],
      skillType: "Basic Attack" as const,
      skillName: "Test",
    } as unknown as ResolvedStage
    resolvedStages.set("s1", stage)
    const items = call([topEntry("e1", 1, "s1")])
    expect(entryItems(items)[0].stageWithVariants).not.toBeNull()
  })

  it("stageWithVariants is null when stage has no variants", () => {
    const stage = {
      stage: { actionTime: 30 },
      stageId: "s1",
      stageName: "Test",
      element: "Fusion",
      concerto: 0,
      damage: [],
      skillType: "Basic Attack" as const,
      skillName: "Test",
    } as ResolvedStage
    resolvedStages.set("s1", stage)
    const items = call([topEntry("e1", 1, "s1")])
    expect(entryItems(items)[0].stageWithVariants).toBeNull()
  })

  // Validation slice attachment
  it("isInvalid is true when entry id is in invalidRowIds", () => {
    const validation: ValidationResult = {
      rowErrors: new Map(),
      rowWarnings: new Map(),
      invalidRowIds: new Set(["e1"]),
    }
    const items = call([topEntry("e1")], new Set(), validation)
    expect(entryItems(items)[0].isInvalid).toBe(true)
  })

  it("isInvalid is false when entry is not invalid", () => {
    const items = call([topEntry("e1")])
    expect(entryItems(items)[0].isInvalid).toBe(false)
  })

  it("errors are attached per entry", () => {
    const validation: ValidationResult = {
      rowErrors: new Map([["e1", [{ message: "missing skill" }]]]),
      rowWarnings: new Map(),
      invalidRowIds: new Set(["e1"]),
    }
    const items = call([topEntry("e1")], new Set(), validation)
    expect(entryItems(items)[0].errors).toEqual([{ message: "missing skill" }])
  })

  it("warnings are attached per entry", () => {
    const validation: ValidationResult = {
      rowErrors: new Map(),
      rowWarnings: new Map([["e1", [{ message: "same char" }]]]),
      invalidRowIds: new Set(),
    }
    const items = call([topEntry("e1")], new Set(), validation)
    expect(entryItems(items)[0].warnings).toEqual([{ message: "same char" }])
  })

  // showMessage cap-2 behavior
  it("showMessage is true for first 2 entries with errors", () => {
    const validation: ValidationResult = {
      rowErrors: new Map([
        ["e1", [{ message: "err1" }]],
        ["e2", [{ message: "err2" }]],
        ["e3", [{ message: "err3" }]],
      ]),
      rowWarnings: new Map(),
      invalidRowIds: new Set(["e1", "e2", "e3"]),
    }
    const nodes = [topEntry("e1"), topEntry("e2"), topEntry("e3")]
    const entries = entryItems(call(nodes, new Set(), validation))
    expect(entries[0].showMessage).toBe(true)
    expect(entries[1].showMessage).toBe(true)
    expect(entries[2].showMessage).toBe(false)
  })

  it("showMessage counts entries in collapsed groups toward the cap", () => {
    // e1 in a collapsed group has error; e2 (top-level) also has error
    // cap-2: both get showMessage. e3 does not.
    const g = group("g1", ["e1"])
    const validation: ValidationResult = {
      rowErrors: new Map([
        ["e1", [{ message: "err" }]],
        ["e2", [{ message: "err" }]],
        ["e3", [{ message: "err" }]],
      ]),
      rowWarnings: new Map(),
      invalidRowIds: new Set(["e1", "e2", "e3"]),
    }
    const nodes: TimelineNode[] = [g, topEntry("e2"), topEntry("e3")]
    // group is collapsed (not in expandedGroupIds) so e1 not in render items
    const items = call(nodes, new Set(), validation)
    const entries = entryItems(items)
    // entries visible: e2 (flatIndex=1), e3 (flatIndex=2)
    // e1 consumed one message slot (even though not visible)
    expect(entries[0].showMessage).toBe(true) // e2: slot 2
    expect(entries[1].showMessage).toBe(false) // e3: capped
  })

  it("showMessage is false for entries with no errors", () => {
    const items = call([topEntry("e1")])
    expect(entryItems(items)[0].showMessage).toBe(false)
  })
})
