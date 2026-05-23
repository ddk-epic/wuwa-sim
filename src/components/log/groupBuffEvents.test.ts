import { describe, expect, it } from "vitest"
import type { BuffEvent, SimulationLogEntry } from "#/types/simulation-log"
import { groupBuffEvents } from "./groupBuffEvents"

function buff(
  buffId: string,
  targetCharacterId: number,
  frame = 0,
  kind: BuffEvent["kind"] = "buffApplied",
  stacks = 1,
): BuffEvent {
  return {
    kind,
    buffId,
    buffName: buffId,
    sourceCharacterId: 0,
    targetCharacterId,
    frame,
    stacks,
  }
}

function hit(): SimulationLogEntry {
  return {
    kind: "hit",
    characterId: 0,
    skillType: "Basic Attack",
    skillName: "hit",
    frame: 0,
    damage: 0,
    element: "Fusion",
    dmgType: "Damage",
    multiplier: 1,
    statsSnapshot: {} as never,
    activeBuffs: [],
    passiveBuffs: [],
    cumulativeEnergy: 0,
    cumulativeConcerto: 0,
  }
}

describe("groupBuffEvents", () => {
  it("single buff event → one buffGroup with one entry", () => {
    const rows = groupBuffEvents([buff("a", 1)])
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe("buffGroup")
    if (rows[0].kind === "buffGroup") {
      expect(rows[0].entries).toHaveLength(1)
      expect(rows[0].entries[0].targetCharacterIds).toEqual([1])
    }
  })

  it("N same-buffId different-targets → one entry with multiple targetCharacterIds", () => {
    const rows = groupBuffEvents([buff("a", 1), buff("a", 2), buff("a", 3)])
    expect(rows).toHaveLength(1)
    if (rows[0].kind === "buffGroup") {
      expect(rows[0].entries).toHaveLength(1)
      expect(rows[0].entries[0].targetCharacterIds).toEqual([1, 2, 3])
    }
  })

  it("N different-buffIds same-kind same-frame → one buffGroup with N entries", () => {
    const rows = groupBuffEvents([buff("a", 1), buff("b", 1), buff("c", 2)])
    expect(rows).toHaveLength(1)
    if (rows[0].kind === "buffGroup") {
      expect(rows[0].entries).toHaveLength(3)
      expect(rows[0].entries.map((e) => e.buffId)).toEqual(["a", "b", "c"])
    }
  })

  it("mixed kinds same frame → separate buffGroup rows", () => {
    const rows = groupBuffEvents([
      buff("a", 1, 0, "buffApplied"),
      buff("b", 2, 0, "buffExpired"),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].kind).toBe("buffGroup")
    expect(rows[1].kind).toBe("buffGroup")
    if (rows[0].kind === "buffGroup")
      expect(rows[0].buffKind).toBe("buffApplied")
    if (rows[1].kind === "buffGroup")
      expect(rows[1].buffKind).toBe("buffExpired")
  })

  it("intervening hit breaks the run into separate groups", () => {
    const rows = groupBuffEvents([buff("a", 1), hit(), buff("b", 2)])
    expect(rows).toHaveLength(3)
    expect(rows[0].kind).toBe("buffGroup")
    expect(rows[1].kind).toBe("single")
    expect(rows[2].kind).toBe("buffGroup")
  })

  it("same buffId differing stacks → separate entries", () => {
    const rows = groupBuffEvents([
      buff("a", 1, 0, "buffApplied", 1),
      buff("a", 2, 0, "buffApplied", 2),
    ])
    expect(rows).toHaveLength(1)
    if (rows[0].kind === "buffGroup") {
      expect(rows[0].entries).toHaveLength(2)
      expect(rows[0].entries[0].stacks).toBe(1)
      expect(rows[0].entries[1].stacks).toBe(2)
    }
  })

  it("empty log → empty result", () => {
    expect(groupBuffEvents([])).toEqual([])
  })

  it("preserves engine emission order within a group", () => {
    const rows = groupBuffEvents([buff("x", 3), buff("y", 1), buff("x", 2)])
    if (rows[0].kind === "buffGroup") {
      expect(rows[0].entries[0].buffId).toBe("x")
      expect(rows[0].entries[0].targetCharacterIds).toEqual([3, 2])
      expect(rows[0].entries[1].buffId).toBe("y")
    }
  })
})
