import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { BuffDef } from "#/types/buff"
import type { HitEvent } from "#/types/simulation-log"

import { runSimulation } from "./simulation"
import { makeChar, stageOf, tlEntry } from "./simulation.test-fixtures"

let testCharacters: EnrichedCharacter[] = []
vi.mock("./loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getEchoById: () => null,
}))
afterEach(() => {
  testCharacters = []
})

const loadout: SlotLoadout = {
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
  echoBuild: "4-3-3-1-1",
  cost4Mains: ["cd"],
  cost3Mains: ["elemDmg", "elemDmg"],
}
const loadouts: SlotLoadout[] = [loadout, loadout, loadout]

const erosionApply: BuffDef = {
  id: "char.apply-erosion",
  name: "Apply Erosion",
  trigger: {
    event: "skillCast",
    characterId: 1,
    skillCategory: "Basic Attack",
  },
  effects: [{ kind: "negStatus", status: "Aero Erosion", op: "apply", n: 1 }],
}

describe("runSimulation — Aero Erosion ticks", () => {
  it("logs periodic erosion-DMG hits attributed to the inflictor past the last action", () => {
    testCharacters = [makeChar(1, "Inflictor", [erosionApply])]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [tlEntry(1, stageOf("inflictor"), "e1")],
      slots,
      loadouts,
    )

    const ticks = log.filter(
      (e): e is HitEvent =>
        e.kind === "hit" && e.sourceBuffId === "negStatus.Aero Erosion",
    )
    expect(ticks.map((t) => t.frame)).toEqual([150, 300, 450, 600, 750])
    expect(ticks.every((t) => t.synthetic === true)).toBe(true)
    expect(ticks.every((t) => t.characterId === 1)).toBe(true)
    expect(ticks.every((t) => t.damage > 0)).toBe(true)
  })
})
