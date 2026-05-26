import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { runSimulation } from "#/lib/simulation"
import { encore } from "./encore"

let testCharacters: EnrichedCharacter[] = []

vi.mock("../../lib/loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getWeaponById: () => null,
  getEchoById: () => null,
  getEchoSetById: () => null,
}))

afterEach(() => {
  testCharacters = []
})

const emptyLoadout: SlotLoadout = {
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

describe("Encore — Skill.concerto grant on Liberation cast", () => {
  it("Cosmos Rave cast grants +20 concerto via 'Skill DMG' stage", () => {
    testCharacters = [{ ...encore } as unknown as EnrichedCharacter]
    const slots: Slots = [1203, null, null]
    const loadouts: SlotLoadout[] = [emptyLoadout, emptyLoadout, emptyLoadout]
    const entry: TimelineEntry = {
      id: "t1",
      characterId: 1203,
      stageId: "char.encore.resonance-liberation.cosmos-rave._",
    }
    const log = runSimulation([entry], slots, loadouts)
    const action = log.find((e) => e.kind === "action")
    expect(action?.cumulativeConcerto).toBe(20)
  })
})
