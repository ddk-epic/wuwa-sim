import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  DamageEntry,
  EnrichedCharacter,
  SkillType,
} from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { ActionEvent } from "#/types/simulation-log"

import { runSimulation } from "./simulation"
import { tlEntry } from "./simulation.test-fixtures"

let testCharacters: EnrichedCharacter[] = []
vi.mock("./loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getEchoById: () => null,
}))
afterEach(() => {
  testCharacters = []
})

const emptyLoadouts: SlotLoadout[] = [
  {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
    echoBuild: "4-3-3-1-1",
    cost4Mains: ["cd"],
    cost3Mains: ["elemDmg", "elemDmg"],
  },
  {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
    echoBuild: "4-3-3-1-1",
    cost4Mains: ["cd"],
    cost3Mains: ["elemDmg", "elemDmg"],
  },
  {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
    echoBuild: "4-3-3-1-1",
    cost4Mains: ["cd"],
    cost3Mains: ["elemDmg", "elemDmg"],
  },
]

const dmgHit = (
  value: number,
  energy = 0,
  concerto = 0,
  type: SkillType = "Basic Attack",
): DamageEntry => ({
  type,
  dmgType: "Fusion",
  scalingStat: "atk",
  actionFrame: 0,
  value,
  energy,
  concerto,
  toughness: 0,
  weakness: 0,
})

const charA: EnrichedCharacter = {
  id: 1,
  name: "Char A",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 1,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage 1",
          category: "Basic Attack",
          value: "100%",
          actionTime: 60,
          damage: [dmgHit(1.5, 5, 2)],
        },
        {
          name: "Stage 2",
          category: "Basic Attack",
          value: "80% + 60%",
          newName: "(Stage 2)",
          actionTime: 40,
          damage: [dmgHit(0.8, 3, 1), dmgHit(0.6, 3, 1)],
        },
      ],
      damage: [],
    },
  ],
}

const charAerial: EnrichedCharacter = {
  ...charA,
  id: 50,
  name: "Aerial Char",
  skills: [
    {
      id: 100,
      name: "Launch",
      type: "Resonance Skill",
      stages: [
        {
          name: "Launch Stage",
          category: "Resonance Skill",
          value: "100%",
          actionTime: 30,
          footing: { launch: 15 },
          damage: [],
        },
      ],
      damage: [],
    },
    {
      id: 101,
      name: "Aerial Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Aerial Stage",
          category: "Basic Attack",
          value: "100%",
          actionTime: 40,
          footing: "air",
          damage: [],
        },
      ],
      damage: [],
    },
    {
      id: 102,
      name: "Ground Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Ground Stage",
          category: "Basic Attack",
          value: "100%",
          actionTime: 50,
          footing: "ground",
          damage: [],
          variants: { cancel: { actionTime: 10 } },
        },
      ],
      damage: [],
    },
    {
      id: 103,
      name: "Neutral",
      type: "Normal Attack",
      stages: [
        {
          name: "Neutral Stage",
          category: "Basic Attack",
          value: "100%",
          actionTime: 45,
          damage: [],
        },
      ],
      damage: [],
    },
  ],
}

const charAerialB: EnrichedCharacter = {
  ...charAerial,
  id: 51,
  name: "Aerial Char B",
}

function aerialSlots(): Slots {
  return [50, 51, null]
}

const snapDmg = (actionFrame: number): DamageEntry => ({
  type: "Resonance Skill",
  dmgType: "Fusion",
  scalingStat: "atk",
  actionFrame,
  value: 1,
  energy: 0,
  concerto: 0,
  toughness: 0,
  weakness: 0,
})

const charSnapA: EnrichedCharacter = {
  ...charA,
  id: 52,
  name: "Snap A",
  skills: [
    {
      id: 300,
      name: "Aerial Swap",
      type: "Resonance Skill",
      stages: [
        {
          name: "Aerial Swap Stage",
          category: "Resonance Skill",
          value: "",
          actionTime: 30,
          footing: { launch: 15 },
          damage: [
            snapDmg(3), // immediate (â‰¤ swapFrames=6)
            snapDmg(20), // trailing (> swapFrames=6) — activates window
          ],
        },
      ],
      damage: [],
    },
    {
      id: 301,
      name: "Ground Stage",
      type: "Normal Attack",
      stages: [
        {
          name: "Ground Stage",
          category: "Basic Attack",
          value: "",
          actionTime: 50,
          footing: "ground",
          damage: [],
        },
      ],
      damage: [],
    },
  ],
}

const charSnapB: EnrichedCharacter = { ...charSnapA, id: 53, name: "Snap B" }

function snapSlots(): Slots {
  return [52, 53, null]
}

describe("runSimulation — trailing-window footing snapshot (ADR-0022 slice 3)", () => {
  it("aerial swap-variant â†’ long teammate action â†’ charA re-enters past its window â†’ benched to ground (no fall)", () => {
    // charA aerial swap launches at frame 15 (window [0, actionTime=30)). charB's
    // ground stage is 50 frames, so charA re-enters well past frame 30 â†’ In-trailing
    // â†’ In-reserve: its carried "air" reset to "ground" at window-end. No fall.
    // (The within-window swap-back-pays-fall case is covered below at re-entry frame 6.)
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId: "char.snap-a.resonance-skill.aerial-swap._::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage._::basic-attack",
        "e2",
      ),
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage._::basic-attack",
        "e3",
      ),
    ]
    const result = runSimulation(
      entries,
      snapSlots(),
      emptyLoadouts,
      0,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const reentry = actions.find((a) => a.sourceEntryId === "e3")
    expect(reentry?.delayBreakdown?.fall ?? 0).toBe(0)
  })

  it("swap-variant with {launch:N}: re-entry past window â†’ carried air reset to ground (no fall)", () => {
    // charA Launch swap ({launch:15}, advance=6): launch frame > advance â†’ footing
    // commit on the stream sets charA's carried "air" at frame 15. charB's action
    // pushes charA's re-entry past the window-end (stageStart + actionTime), so the
    // In-trailing â†’ In-reserve reset returns charA to ground first â†’ no fall.
    testCharacters = [charAerial, charAerialB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 50,
        stageId: "char.aerial-char.resonance-skill.launch._::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        51,
        "char.aerial-char-b.basic-attack.ground-attack._::basic-attack",
        "e2",
      ),
      tlEntry(
        50,
        "char.aerial-char.basic-attack.ground-attack._::basic-attack",
        "e3",
      ),
    ]
    const result = runSimulation(
      entries,
      aerialSlots(),
      emptyLoadouts,
      0,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const reentry = actions.find((a) => a.sourceEntryId === "e3")
    expect(reentry?.delayBreakdown?.fall ?? 0).toBe(0)
  })

  it("different character enters while launch is pending: inherits ground (not yet-committed air)", () => {
    // charA swap-cancel before launch frame: team stays ground when charB enters.
    // charB sees ground footing â†’ no fall. charA's pending footing fires off-field only
    // on charA's re-entry, not when charB enters.
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId: "char.snap-a.resonance-skill.aerial-swap._::resonance-skill",
        variantKind: "swap",
      }, // {launch:15}, swap advance=6 < 15 â†’ pending; team stays ground
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage._::basic-attack",
        "e2",
      ), // charB enters: team=ground â†’ no fall
    ]
    const result = runSimulation(
      entries,
      snapSlots(),
      emptyLoadouts,
      0,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const charBAction = actions.find((a) => a.sourceEntryId === "e2")
    expect(charBAction?.delayBreakdown?.fall ?? 0).toBe(0)
  })

  it("consecutive aerial swap-variants layer per-character snapshots independently", () => {
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId: "char.snap-a.resonance-skill.aerial-swap._::resonance-skill",
        variantKind: "swap",
      },
      {
        id: "e2",
        characterId: 53,
        stageId: "char.snap-a.resonance-skill.aerial-swap._::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage._::basic-attack",
        "e3",
      ),
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage._::basic-attack",
        "e4",
      ),
    ]
    const result = runSimulation(
      entries,
      snapSlots(),
      emptyLoadouts,
      0,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const charAReentry = actions.find((a) => a.sourceEntryId === "e3")
    const charBReentry = actions.find((a) => a.sourceEntryId === "e4")
    expect(charAReentry?.delayBreakdown?.fall).toBe(21)
    expect(charBReentry?.delayBreakdown?.fall).toBe(21)
  })
})

describe("runSimulation — footing commit as trailing-window event (ADR-0022 slice 4)", () => {
  it("early-cancel swap: incoming char inherits ground; charA re-enters past window â†’ ground (no fall)", () => {
    // charA swaps out before its launch frame 15 â†’ team stays ground â†’ charB inherits
    // ground. charA's launch commit sets its carried "air" at frame 15, but charB's
    // 50-frame action pushes charA's re-entry past window-end â†’ carried air reset to
    // ground â†’ charA enters grounded, no fall.
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId: "char.snap-a.resonance-skill.aerial-swap._::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage._::basic-attack",
        "e2",
      ),
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage._::basic-attack",
        "e3",
      ),
    ]
    const result = runSimulation(
      entries,
      snapSlots(),
      emptyLoadouts,
      0,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.fall ?? 0,
    ).toBe(0)
    expect(
      actions.find((a) => a.sourceEntryId === "e3")?.delayBreakdown?.fall ?? 0,
    ).toBe(0)
  })

  it("late-cancel swap: launch fires on-field â†’ team flips to air â†’ incoming char inherits air", () => {
    // charA non-swap Launch ({launch:15} â‰¤ advance=30) â†’ on-field dispatch â†’ team=air â†’
    // charB enters after charA's full advance â†’ team=air â†’ charB pays fall
    testCharacters = [charAerial, charAerialB]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch._::resonance-skill",
        "e1",
      ),
      tlEntry(
        51,
        "char.aerial-char-b.basic-attack.ground-attack._::basic-attack",
        "e2",
      ),
    ]
    const result = runSimulation(
      entries,
      aerialSlots(),
      emptyLoadouts,
      0,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.fall,
    ).toBe(21)
  })

  it("cancel-capable same-char re-entry before pending launch frame: drops footing (no team flip, no snapshot)", () => {
    // charA swap at frame 0 â†’ pending footing at frame 15
    // charA Resonance Skill re-entry at frame 6 (< 15) â†’ cancel-capable drop â†’
    // no snapshot, no team flip; charA's new entry sees team=ground â†’ no fall
    testCharacters = [charSnapA]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId: "char.snap-a.resonance-skill.aerial-swap._::resonance-skill",
        variantKind: "swap",
      },
      {
        id: "e2",
        characterId: 52,
        stageId: "char.snap-a.resonance-skill.aerial-swap._::resonance-skill",
        variantKind: "swap",
      },
    ]
    const result = runSimulation(
      entries,
      snapSlots(),
      emptyLoadouts,
      0,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.fall ?? 0,
    ).toBe(0)
  })

  it("non-cancel-capable same-char re-entry: pads to cover launch frame; footing fires â†’ fall on re-entry", () => {
    // charA swap at frame 0 â†’ pending footing at frame 15, trailing hit at frame 20
    // charA Normal Attack re-entry at frame 6 â†’ non-cancel-capable â†’
    // pad = max(hitFrame=20, footingAtFrame=15) - 6 = 14; pendingFooting fires â†’ snapshot â†’
    // on-field invariant promotes to air â†’ charA pays fall
    testCharacters = [charSnapA]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId: "char.snap-a.resonance-skill.aerial-swap._::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage._::basic-attack",
        "e2",
      ),
    ]
    const result = runSimulation(
      entries,
      snapSlots(),
      emptyLoadouts,
      0,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const reentry = actions.find((a) => a.sourceEntryId === "e2")
    expect(reentry?.delayBreakdown?.fall).toBe(21)
    expect(reentry?.delayBreakdown?.pad).toBe(14)
  })

  it("trailing-window natural expiry does not flip team footing (pending footing dropped, not dispatched)", () => {
    // charA swap with pending footing, simulation ends without charA re-entering.
    // drainAll fires trailing hits but pending footing is silently dropped.
    // Team footing stays ground throughout.
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId: "char.snap-a.resonance-skill.aerial-swap._::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage._::basic-attack",
        "e2",
      ),
    ]
    const result = runSimulation(
      entries,
      snapSlots(),
      emptyLoadouts,
      0,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    // charB enters while charA's pending footing is still in the window (not yet fired)
    // â†’ charB sees ground â†’ no fall
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.fall ?? 0,
    ).toBe(0)
    // trailing hit from charA fires via drainAll (1 immediate + 1 trailing = 2 total)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(2)
  })
})
