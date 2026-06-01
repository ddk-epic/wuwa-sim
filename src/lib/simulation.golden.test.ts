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
 * Characterization goldens for the first-class-emitHits port (ADR-0028).
 *
 * These snapshot the **current** (master == α-oracle) behavior of the
 * Simulation Log via {@link serializeLog}. They are the tripwire: every step
 * of the worklist port must keep these byte-identical, *except* the deliberate
 * β frame-reorder diffs, which are reviewed by hand when they appear.
 *
 * Fixtures are self-contained on purpose — they depend on no real character
 * data, so a snapshot only moves when the *engine's* ordering/timing changes,
 * never when someone retunes a shipped character.
 *
 * Coverage today targets the worklist's actual surface: same-frame collision,
 * synthetic (emitHit) emission order, coord (coordHit) ordering, and swap +
 * energy-share resource timing. Footing-commit goldens are added when footing
 * commits are folded onto the queue (charter staging step 4).
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

/** A character with one "Normal Attack" skill whose Stage 1 carries `damage`. */
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

/** stageId for a `makeChar(...)` character's Stage 1, matching enrichment lineage. */
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

describe("golden: simulation log ordering (ADR-0028 oracle)", () => {
  it("same-frame collision — two damage entries land on frame 0", () => {
    testCharacters = [
      makeChar(1, "Gold A", [dmgHit(1.5, 5, 2), dmgHit(0.8, 3, 1)]),
    ]
    const slots: Slots = [1, null, null]
    const log = runSimulation([tlEntry(1, stageOf("gold-a"))], slots, loadouts)
    expect(serializeLog(log)).toMatchSnapshot()
  })

  it("emit chain — an authored hit triggers a synthetic emitHit", () => {
    const emitBuff: BuffDef = {
      id: "gold.emit-on-hit",
      name: "Emit On Hit",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmgHit(2.0), icdFrames: 0 }],
    }
    testCharacters = [makeChar(1, "Gold A", [dmgHit(1.5, 5, 2)], [emitBuff])]
    const slots: Slots = [1, null, null]
    const log = runSimulation([tlEntry(1, stageOf("gold-a"))], slots, loadouts)
    expect(serializeLog(log)).toMatchSnapshot()
  })

  it("coord pair — a hitLanded fires a coordHit damage + heal", () => {
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
    testCharacters = [makeChar(1, "Gold A", [dmgHit(1.5, 5, 2)], [coordBuff])]
    const slots: Slots = [1, null, null]
    const log = runSimulation([tlEntry(1, stageOf("gold-a"))], slots, loadouts)
    expect(serializeLog(log)).toMatchSnapshot()
  })

  it("swap + energy share — two characters, energy shared to teammate", () => {
    testCharacters = [
      makeChar(1, "Gold A", [dmgHit(1.5, 20, 10)]),
      makeChar(2, "Gold B", [dmgHit(0.8, 4, 2)]),
    ]
    const slots: Slots = [1, 2, null]
    const log = runSimulation(
      [tlEntry(1, stageOf("gold-a")), tlEntry(2, stageOf("gold-b"))],
      slots,
      loadouts,
    )
    expect(serializeLog(log)).toMatchSnapshot()
  })

  it("trailing hit interleaves frame-honestly with a later entry's hit (ADR-0028 endgame)", () => {
    // Gold A swaps out; its actionFrame-30 hit trails (advance = swapFrames 6).
    // Gold B then hits at frame 6 + 40 = 46. The trailing hit at frame 30 must
    // land *between* Gold B's action (frame 6) and Gold B's hit (frame 46) — the
    // unified stream resolves it in frame order, not flushed at the end.
    testCharacters = [
      makeChar(1, "Gold A", [dmgHit(1.5, 0, 0, 0), dmgHit(2.0, 0, 0, 30)]),
      makeChar(2, "Gold B", [dmgHit(0.8, 0, 0, 40)]),
    ]
    const slots: Slots = [1, 2, null]
    const entries: TimelineEntry[] = [
      { ...tlEntry(1, stageOf("gold-a"), "e1"), variantKind: "swap" },
      tlEntry(2, stageOf("gold-b"), "e2"),
    ]
    const log = runSimulation(entries, slots, loadouts)
    expect(serializeLog(log)).toMatchSnapshot()
  })
})
