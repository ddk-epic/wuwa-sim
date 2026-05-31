import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  DamageEntry,
  EnrichedCharacter,
  SkillType,
} from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { BuffDef } from "#/types/buff"
import type { HitEvent, SimulationLogEntry } from "#/types/simulation-log"

import { runSimulation } from "./simulation"

/**
 * Honor-`actionFrame` (the β flip) for deferred emitHits (ADR-0028).
 *
 * With `honorEmitOffset` on, an `emitHit` whose `damage.actionFrame > 0` lands
 * at `triggerFrame + actionFrame` and interleaves into the log in frame order —
 * after its trigger but before a later authored entry it now precedes. With the
 * flag off (default, exercised everywhere else) it stays glued to the trigger
 * frame. Both paths are asserted here so the behavior change is pinned to the
 * flag.
 */

const dmgHit = (
  value: number,
  type: SkillType = "Basic Attack",
): DamageEntry => ({
  type,
  dmgType: "Fusion",
  scalingStat: "atk",
  actionFrame: 0,
  value,
  energy: 0,
  concerto: 0,
  toughness: 0,
  weakness: 0,
})

/** An emitHit fired by the caster's own hit, landing `offset` frames later. */
const emitBuff = (offset: number): BuffDef => ({
  id: "gold.deferred-emit",
  name: "Deferred Emit",
  trigger: { event: "hitLanded", characterId: 1, source: "self" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  effects: [
    {
      kind: "emitHit",
      icdFrames: 0,
      damage: { ...dmgHit(2.0, "Resonance Skill"), actionFrame: offset },
    },
  ],
})

function makeChar(
  id: number,
  name: string,
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
            damage: [dmgHit(1.5)],
          },
        ],
        damage: [],
      },
    ],
  }
}

const stageOf = (kebab: string) =>
  `char.${kebab}.basic-attack.normal-attack._::basic-attack`
const tlEntry = (
  characterId: number,
  stageId: string,
  id: string,
): TimelineEntry => ({
  id,
  characterId,
  stageId,
})

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

const isSynth = (e: SimulationLogEntry): e is HitEvent =>
  e.kind === "hit" && e.sourceBuffId === "gold.deferred-emit"

describe("deferred emitHit — honor actionFrame (ADR-0028 flip)", () => {
  it("explicit legacy (honorEmitOffset: false): synthetic glued to its trigger frame", () => {
    testCharacters = [
      makeChar(1, "Gold A", [emitBuff(30)]),
      makeChar(2, "Gold B"),
    ]
    const slots: Slots = [1, 2, null]
    const entries = [
      tlEntry(1, stageOf("gold-a"), "e1"),
      tlEntry(2, stageOf("gold-b"), "e2"),
    ]
    const log = runSimulation(entries, slots, loadouts, 9, 6, 0, 21, {
      honorEmitOffset: false,
    })
    const synth = log.find(isSynth)
    expect(synth?.frame).toBe(0)
    // glued to its trigger (e1's hit), before e2's action
    const synthIdx = log.findIndex(isSynth)
    const e2Action = log.findIndex(
      (e) => e.kind === "action" && e.sourceEntryId === "e2",
    )
    expect(synthIdx).toBeLessThan(e2Action)
  })

  it("default (flipped on): synthetic lands at trigger + actionFrame and interleaves before the later entry", () => {
    testCharacters = [
      makeChar(1, "Gold A", [emitBuff(30)]),
      makeChar(2, "Gold B"),
    ]
    const slots: Slots = [1, 2, null]
    const entries = [
      tlEntry(1, stageOf("gold-a"), "e1"),
      tlEntry(2, stageOf("gold-b"), "e2"),
    ]
    // No honorEmitOffset opt — relies on the flipped default (ADR-0028).
    const log = runSimulation(entries, slots, loadouts)
    const synth = log.find(isSynth)
    // e1 hits at frame 0; the synthetic is authored +30 → lands at frame 30.
    expect(synth?.frame).toBe(30)

    // e1 lands at 0, e2's stage advances the cursor to 60, so frame 30 sits
    // strictly between them: after e1's hit, before e2's action.
    const e1Hit = log.findIndex(
      (e) => e.kind === "hit" && e.sourceEntryId === "e1",
    )
    const synthIdx = log.findIndex(isSynth)
    const e2Action = log.findIndex(
      (e) => e.kind === "action" && e.sourceEntryId === "e2",
    )
    expect(e1Hit).toBeLessThan(synthIdx)
    expect(synthIdx).toBeLessThan(e2Action)
  })

  it("no later entry: deferred synthetic still resolves at the end", () => {
    testCharacters = [makeChar(1, "Gold A", [emitBuff(30)])]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [tlEntry(1, stageOf("gold-a"), "e1")],
      slots,
      loadouts,
    )
    const synth = log.find(isSynth)
    expect(synth?.frame).toBe(30)
  })
})
