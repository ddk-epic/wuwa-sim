import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  DamageEntry,
  EnrichedCharacter,
  SkillType,
} from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { BuffDef } from "#/types/buff"

import { runSimulation } from "./simulation"
import { serializeLog } from "./sim-log-serializer"

/**
 * Worklist parity gate (ADR-0028, staging step 2).
 *
 * The `useWorklist` flag routes authored entries through the drain seam instead
 * of the plain `for` walk. Seeded with authored entries only, the two paths
 * MUST produce byte-identical Simulation Logs. This file proves that by running
 * each timeline both ways and comparing the serialized log directly — a
 * stronger, self-checking gate than a snapshot (no golden to drift).
 *
 * When synthetic/trailing emission moves onto the worklist in later steps, this
 * gate is what catches an accidental reorder before the β frame-flip is even
 * in play.
 */

const dmgHit = (
  value: number,
  energy = 0,
  concerto = 0,
  actionFrame = 0,
  type: SkillType = "Basic Attack",
): DamageEntry => ({
  type,
  dmgType: "Fusion",
  scalingStat: "atk",
  actionFrame,
  value,
  energy,
  concerto,
  toughness: 0,
  weakness: 0,
})

const healEntry = (value: number, flat = 0): DamageEntry => ({
  type: "Basic Attack",
  dmgType: "Heal",
  scalingStat: "ATK",
  actionFrame: 0,
  flat,
  value,
  energy: 0,
  concerto: 0,
  toughness: 0,
  weakness: 0,
  target: "self",
})

function makeChar(
  id: number,
  name: string,
  damage: DamageEntry[],
  buffs: BuffDef[] = [],
): EnrichedCharacter {
  return {
    id,
    name,
    element: "Fusion",
    weaponType: "Sword",
    rarity: "5",
    stats: {
      base: { hp: 0, atk: 0, def: 0 },
      max: { hp: 0, atk: 1000, def: 0 },
    },
    template: { weapon: "", echo: "", echoSet: "" },
    skillTreeBonuses: [],
    buffs,
    skills: [
      {
        id: id * 10,
        name: "Normal Attack",
        type: "Normal Attack",
        stages: [
          {
            name: "Stage 1",
            category: "Basic Attack",
            value: "100%",
            actionTime: 60,
            damage,
          },
        ],
        damage: [],
      },
    ],
  }
}

const stageOf = (nameKebab: string) =>
  `char.${nameKebab}.basic-attack.normal-attack._::basic-attack`

function tlEntry(
  characterId: number,
  stageId: string,
  id?: string,
): TimelineEntry {
  return { id: id ?? `${characterId}-${stageId}`, characterId, stageId }
}

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

/** Run a timeline both ways; return [walkLog, worklistLog] as serialized text. */
function bothWays(entries: TimelineEntry[], slots: Slots): [string, string] {
  const walk = runSimulation(entries, slots, loadouts, 9, 6, 0, 21, {
    useWorklist: false,
  })
  const work = runSimulation(entries, slots, loadouts, 9, 6, 0, 21, {
    useWorklist: true,
  })
  return [serializeLog(walk), serializeLog(work)]
}

describe("worklist parity — authored entries only (ADR-0028 step 2)", () => {
  it("empty timeline", () => {
    const [walk, work] = bothWays([], [null, null, null])
    expect(work).toBe(walk)
  })

  it("single multi-hit entry (same-frame collision)", () => {
    testCharacters = [
      makeChar(1, "Gold A", [dmgHit(1.5, 5, 2), dmgHit(0.8, 3, 1)]),
    ]
    const [walk, work] = bothWays(
      [tlEntry(1, stageOf("gold-a"))],
      [1, null, null],
    )
    expect(work).toBe(walk)
  })

  it("emit + coord buffs on a single entry", () => {
    const emitBuff: BuffDef = {
      id: "gold.emit-on-hit",
      name: "Emit On Hit",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmgHit(2.0), icdFrames: 0 }],
    }
    const coordBuff: BuffDef = {
      id: "gold.coord-pair",
      name: "Coord Pair",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        { kind: "coordHit", damage: dmgHit(1.2), icdFrames: 0 },
        { kind: "coordHit", damage: healEntry(0.5, 100), icdFrames: 0 },
      ],
    }
    testCharacters = [
      makeChar(1, "Gold A", [dmgHit(1.5, 5, 2)], [emitBuff, coordBuff]),
    ]
    const [walk, work] = bothWays(
      [tlEntry(1, stageOf("gold-a"))],
      [1, null, null],
    )
    expect(work).toBe(walk)
  })

  it("multi-character swap with energy share and emit/coord interleaving", () => {
    const emitBuff: BuffDef = {
      id: "gold.emit-on-hit",
      name: "Emit On Hit",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmgHit(2.0), icdFrames: 0 }],
    }
    testCharacters = [
      makeChar(1, "Gold A", [dmgHit(1.5, 20, 10)], [emitBuff]),
      makeChar(2, "Gold B", [dmgHit(0.8, 4, 2)]),
      makeChar(3, "Gold C", [dmgHit(1.0, 6, 3)]),
    ]
    const entries = [
      tlEntry(1, stageOf("gold-a"), "e1"),
      tlEntry(2, stageOf("gold-b"), "e2"),
      tlEntry(1, stageOf("gold-a"), "e3"),
      tlEntry(3, stageOf("gold-c"), "e4"),
    ]
    const [walk, work] = bothWays(entries, [1, 2, 3])
    expect(work).toBe(walk)
  })
})
