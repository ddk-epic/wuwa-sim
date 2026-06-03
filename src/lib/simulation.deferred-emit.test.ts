import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { BuffDef } from "#/types/buff"
import type { HitEvent, SimulationLogEntry } from "#/types/simulation-log"

import { runSimulation } from "./simulation"
import { dmgHit, makeChar, stageOf, tlEntry } from "./simulation.test-fixtures"

/**
 * Honor-`actionFrame` for deferred emitHits.
 *
 * An `emitHit` whose `damage.actionFrame > 0` lands at `triggerFrame +
 * actionFrame` and interleaves into the log in frame order — after its trigger
 * but before a later authored entry it now precedes.
 */

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

describe("deferred emitHit — honor actionFrame (ADR-0028)", () => {
  it("synthetic lands at trigger + actionFrame and interleaves before the later entry", () => {
    testCharacters = [
      makeChar(1, "Gold A", [emitBuff(30)]),
      makeChar(2, "Gold B"),
    ]
    const slots: Slots = [1, 2, null]
    const entries = [
      tlEntry(1, stageOf("gold-a"), "e1"),
      tlEntry(2, stageOf("gold-b"), "e2"),
    ]
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

describe("deferred emitHit — no overshoot (ADR-0028 endgame item 1)", () => {
  // A self stat buff applied on Gold A's hit (frame 0) that expires at frame 135.
  const tempAtk: BuffDef = {
    id: "gold.temp-atk",
    name: "Temp ATK",
    trigger: { event: "hitLanded", characterId: 1, source: "self" },
    target: { kind: "self" },
    duration: { kind: "frames", v: 135 },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 1.0 },
      },
    ],
  }

  it("snapshots at the landing frame even when a later authored hit overshoots it", () => {
    const charA = makeChar(1, "Gold A", [emitBuff(130), tempAtk])
    // Gold B's authored hit lands at frame 260 (e2 start 60 + actionFrame 200),
    // ticking the monotonic clock well past the synthetic's landing frame of 130.
    const charB = makeChar(2, "Gold B")
    charB.skills[0].stages[0].damage = [{ ...dmgHit(1.0), actionFrame: 200 }]
    testCharacters = [charA, charB]
    const slots: Slots = [1, 2, null]
    const entries = [
      tlEntry(1, stageOf("gold-a"), "e1"),
      tlEntry(2, stageOf("gold-b"), "e2"),
    ]
    const log = runSimulation(entries, slots, loadouts)
    const synth = log.find(isSynth)
    expect(synth?.frame).toBe(130)
    // `tempAtk` (endTime 135) is active at frame 130, expired by 260. A
    // landing-frame snapshot sees it; an overshot (frame-260) snapshot would not.
    // This fails without `advanceTo` pre-draining before the overshooting hit.
    expect(synth?.activeBuffs.map((b) => b.id)).toContain("gold.temp-atk")
  })
})
