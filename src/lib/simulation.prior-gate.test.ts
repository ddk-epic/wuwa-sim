import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { ActionEvent, HitEvent } from "#/types/simulation-log"

import { runSimulation } from "./simulation"
import { dmgHit } from "./simulation.test-fixtures"

let testCharacters: EnrichedCharacter[] = []
vi.mock("./loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getEchoById: () => null,
}))
afterEach(() => {
  testCharacters = []
})

const lo: SlotLoadout = {
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
const slots: Slots = [1, 2, null]
const loadouts: [SlotLoadout, SlotLoadout, SlotLoadout] = [lo, lo, lo]

const PREREQ = "char.wt.resonance-skill.woolies.prereq::resonance-skill"
const FOLLOW = "char.wt.resonance-skill.woolies.follow::resonance-skill"
const MIN_DELAY = 103

// A Flaming-Woolies-shaped windowed follow-up: Prereq advances its full 108
// frames (≥ minDelay) on a full cast but truncates to 0 on a swap; Follow gates
// on Prereq with minDelay 103.
const windowChar: EnrichedCharacter = {
  id: 1,
  name: "WT",
  element: "Fusion",
  weaponType: "Rectifier",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 10,
      name: "Woolies",
      type: "Resonance Skill",
      stages: [
        {
          name: "Prereq",
          category: "Resonance Skill",
          newName: "Prereq",
          value: "100%",
          actionTime: 108,
          variants: { swap: { actionTime: 0 } },
          damage: [dmgHit(1, 0, 0, "Resonance Skill")],
        },
        {
          name: "Follow",
          category: "Resonance Skill",
          newName: "Follow",
          value: "100%",
          actionTime: 51,
          requiresPriorStageId: PREREQ,
          minDelay: MIN_DELAY,
          damage: [dmgHit(1, 0, 0, "Resonance Skill")],
        },
      ],
      damage: [],
    },
  ],
}

// A second on-field character whose action consumes a known number of frames
// while WT is swapped out.
const filler = (actionTime: number): EnrichedCharacter => ({
  id: 2,
  name: "Filler",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 20,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage 1",
          category: "Basic Attack",
          value: "100%",
          actionTime,
          damage: [dmgHit(1)],
        },
      ],
      damage: [],
    },
  ],
})
const FILLER_STAGE = "char.filler.basic-attack.normal-attack._::basic-attack"

const ent = (
  characterId: number,
  stageId: string,
  id: string,
  variantKind?: TimelineEntry["variantKind"],
): TimelineEntry => ({ id, characterId, stageId, variantKind })

const actionFor = (log: ReturnType<typeof runSimulation>, id: string) =>
  log.find(
    (e): e is ActionEvent => e.kind === "action" && e.sourceEntryId === id,
  )

// reactionDelay 0 keeps the frame arithmetic exact (no variant react padding).
const run = (entries: TimelineEntry[]) =>
  runSimulation(entries, slots, loadouts, 0)

describe("simulation — windowed Prior-Stage Gate minDelay pad", () => {
  it("full-cast prerequisite → follow-up needs no pad (priorGate 0)", () => {
    testCharacters = [windowChar]
    // Prereq advances 108 ≥ minDelay 103, so the follow-up at frame 108 is
    // already past the anchor + minDelay floor (103).
    const log = run([ent(1, PREREQ, "p"), ent(1, FOLLOW, "f")])
    const follow = actionFor(log, "f")
    expect(follow?.frame).toBe(108)
    // No delay components at all ⇒ breakdown omitted.
    expect(follow?.delayBreakdown).toBeUndefined()
  })

  it("swap-cancelled prerequisite + early swap-back surfaces the wait pad, max-combined with swap-back", () => {
    testCharacters = [windowChar, filler(30)]
    // Prereq swap-cancelled at frame 0 (cast frame still recorded). WT swaps out
    // at 0, filler runs 30 frames, WT swaps back at frame 30 — both swap-back
    // (off-field 30 < 60 ⇒ 30) and the gate (anchor 0 + 103 vs cursor 30 ⇒ 73)
    // floor the same start. Combined floor = max(60, 103) = 103.
    const log = run([
      ent(1, PREREQ, "p", "swap"),
      ent(2, FILLER_STAGE, "x"),
      ent(1, FOLLOW, "f"),
    ])
    const follow = actionFor(log, "f")
    expect(follow?.frame).toBe(103)
    expect(follow?.delayBreakdown?.swapBack).toBe(30)
    expect(follow?.delayBreakdown?.priorGate).toBe(43)
  })

  it("swap-cancelled prerequisite, swap-back after the swap-back CD: only the gate pads", () => {
    testCharacters = [windowChar, filler(60)]
    // Filler runs 60 frames, so WT's swap-back CD is fully elapsed (swapBack 0);
    // only the gate pads: anchor 0 + 103 vs cursor 60 ⇒ 43.
    const log = run([
      ent(1, PREREQ, "p", "swap"),
      ent(2, FILLER_STAGE, "x"),
      ent(1, FOLLOW, "f"),
    ])
    const follow = actionFor(log, "f")
    expect(follow?.frame).toBe(103)
    expect(follow?.delayBreakdown?.swapBack).toBe(0)
    expect(follow?.delayBreakdown?.priorGate).toBe(43)
  })

  it("re-casting the prerequisite re-arms the anchor to the most recent cast", () => {
    testCharacters = [windowChar]
    // Prereq full @0 (cursor→108), Prereq swap-cancel @108 (re-arm, cursor stays
    // 108), Follow @108. Anchored to the re-cast (108): pad = 108+103−108 = 103.
    // Anchored to the first cast (0) it would be 0 — so 103 proves the re-arm.
    const log = run([
      ent(1, PREREQ, "p1"),
      ent(1, PREREQ, "p2", "swap"),
      ent(1, FOLLOW, "f"),
    ])
    const follow = actionFor(log, "f")
    expect(follow?.frame).toBe(211)
    expect(follow?.delayBreakdown?.priorGate).toBe(103)
  })
})

// windowChar with Prereq's single hit replaced by 8 trailing hits (frames 33…103),
// matching Flaming Woolies inside its 108-frame window.
const wooliesChar: EnrichedCharacter = {
  ...windowChar,
  skills: [
    {
      id: 10,
      name: "Woolies",
      type: "Resonance Skill",
      stages: [
        {
          name: "Prereq",
          category: "Resonance Skill",
          newName: "Prereq",
          value: "100%",
          actionTime: 108,
          variants: { swap: { actionTime: 0 } },
          damage: [33, 43, 53, 63, 73, 83, 93, 103].map((actionFrame) => ({
            ...dmgHit(1, 0, 0, "Resonance Skill"),
            actionFrame,
          })),
        },
        windowChar.skills[0].stages[1],
      ],
      damage: [],
    },
  ],
}

describe("simulation — gated follow-up does not cancel in-flight trailing hits", () => {
  it("lands all 8 trailing hits when the gate pad holds the follow-up to frame 103", () => {
    testCharacters = [wooliesChar, filler(64)]
    const log = run([
      ent(1, PREREQ, "p", "swap"),
      ent(2, FILLER_STAGE, "x"),
      ent(1, FOLLOW, "f"),
    ])
    const trailing = log.filter(
      (e): e is HitEvent => e.kind === "hit" && e.sourceEntryId === "p",
    )
    expect(trailing.map((h) => h.frame)).toEqual([
      33, 43, 53, 63, 73, 83, 93, 103,
    ])
    expect(actionFor(log, "f")?.frame).toBe(103)
  })
})
