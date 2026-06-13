import { afterEach, describe, expect, it, vi } from "vitest"
import type { DamageEntry, EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { ActionEvent } from "#/types/simulation-log"

import { runSimulation } from "./simulation"
import { dmgHit, tlEntry } from "./simulation.test-fixtures"

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

const charA: EnrichedCharacter = {
  id: 1,
  name: "Char A",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  maxEnergy: 100,
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
    {
      id: 104,
      name: "Air Intro",
      type: "Intro Skill",
      stages: [
        {
          name: "Air Intro Stage",
          category: "Basic Attack",
          value: "100%",
          actionTime: 30,
          footing: "air", // aerial intro: sets the field airborne on entry
          damage: [],
        },
      ],
      damage: [],
    },
    {
      id: 105,
      name: "Ground Intro",
      type: "Intro Skill",
      stages: [
        {
          name: "Ground Intro Stage",
          category: "Basic Attack",
          value: "100%",
          actionTime: 30,
          footing: "ground", // grounded intro: enters clean even from an airborne field
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
            snapDmg(3), // immediate (<= swapFrames=6)
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
    {
      id: 303,
      name: "Land Stage",
      type: "Normal Attack",
      stages: [
        {
          name: "Land Stage",
          category: "Basic Attack",
          value: "",
          actionTime: 5,
          footing: { land: 2 }, // non-swap land: flips team to ground on-field
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

describe("runSimulation — trailing-window footing snapshot", () => {
  it("aerial swap-variant -> long teammate action -> charA re-enters past its window -> benched to ground (no fall)", () => {
    // charA aerial swap launches at frame 15 (window [0, actionTime=30)). charB's
    // ground stage is 50 frames, so charA re-enters well past frame 30 -> In-trailing
    // -> In-reserve: its carried "air" reset to "ground" at window-end. No fall.
    // (The within-window swap-back-pays-fall case is covered below at re-entry frame 6.)
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage.ground-stage::basic-attack",
        "e2",
      ),
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage.ground-stage::basic-attack",
        "e3",
      ),
    ]
    const result = runSimulation(entries, snapSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const reentry = actions.find((a) => a.sourceEntryId === "e3")
    expect(reentry?.delayBreakdown?.pad.fall ?? 0).toBe(0)
  })

  it("swap-variant with {launch:N}: re-entry past window -> carried air reset to ground (no fall)", () => {
    // charA Launch swap ({launch:15}, advance=6): launch frame > advance -> footing
    // commit on the stream sets charA's carried "air" at frame 15. charB's action
    // pushes charA's re-entry past the window-end (stageStart + actionTime), so the
    // In-trailing -> In-reserve reset returns charA to ground first -> no fall.
    testCharacters = [charAerial, charAerialB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 50,
        stageId:
          "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        51,
        "char.aerial-char-b.basic-attack.ground-attack.ground-stage::basic-attack",
        "e2",
      ),
      tlEntry(
        50,
        "char.aerial-char.basic-attack.ground-attack.ground-stage::basic-attack",
        "e3",
      ),
    ]
    const result = runSimulation(entries, aerialSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const reentry = actions.find((a) => a.sourceEntryId === "e3")
    expect(reentry?.delayBreakdown?.pad.fall ?? 0).toBe(0)
  })

  it("different character enters while launch is pending: inherits ground (not yet-committed air)", () => {
    // charA swap-cancel before launch frame: team stays ground when charB enters.
    // charB sees ground footing -> no fall. charA's pending footing fires off-field only
    // on charA's re-entry, not when charB enters.
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      }, // {launch:15}, swap advance=6 < 15 -> pending; team stays ground
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage.ground-stage::basic-attack",
        "e2",
      ), // charB enters: team=ground -> no fall
    ]
    const result = runSimulation(entries, snapSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const charBAction = actions.find((a) => a.sourceEntryId === "e2")
    expect(charBAction?.delayBreakdown?.pad.fall ?? 0).toBe(0)
  })

  it("consecutive aerial swap-variants layer per-character snapshots independently", () => {
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      },
      {
        id: "e2",
        characterId: 53,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage.ground-stage::basic-attack",
        "e3",
      ),
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage.ground-stage::basic-attack",
        "e4",
      ),
    ]
    const result = runSimulation(entries, snapSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const charAReentry = actions.find((a) => a.sourceEntryId === "e3")
    const charBReentry = actions.find((a) => a.sourceEntryId === "e4")
    expect(charAReentry?.delayBreakdown?.pad.fall).toBe(21)
    expect(charBReentry?.delayBreakdown?.pad.fall).toBe(21)
  })
})

describe("runSimulation — footing commit as trailing-window event", () => {
  it("early-cancel swap: incoming char inherits ground; charA re-enters past window -> ground (no fall)", () => {
    // charA swaps out before its launch frame 15 -> team stays ground -> charB inherits
    // ground. charA's launch commit sets its carried "air" at frame 15, but charB's
    // 50-frame action pushes charA's re-entry past window-end -> carried air reset to
    // ground -> charA enters grounded, no fall.
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage.ground-stage::basic-attack",
        "e2",
      ),
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage.ground-stage::basic-attack",
        "e3",
      ),
    ]
    const result = runSimulation(entries, snapSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.pad.fall ??
        0,
    ).toBe(0)
    expect(
      actions.find((a) => a.sourceEntryId === "e3")?.delayBreakdown?.pad.fall ??
        0,
    ).toBe(0)
  })

  it("late-cancel swap: launch fires on-field -> team flips to air -> incoming char inherits air", () => {
    // charA non-swap Launch ({launch:15} <= advance=30) -> on-field dispatch -> team=air ->
    // charB enters after charA's full advance -> team=air -> charB pays fall
    testCharacters = [charAerial, charAerialB]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        "e1",
      ),
      tlEntry(
        51,
        "char.aerial-char-b.basic-attack.ground-attack.ground-stage::basic-attack",
        "e2",
      ),
    ]
    const result = runSimulation(entries, aerialSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.pad.fall,
    ).toBe(21)
  })

  it("cancel-capable same-char re-entry before pending launch frame: drops footing (no team flip, no snapshot)", () => {
    // charA swap at frame 0 -> pending footing at frame 15
    // charA Resonance Skill re-entry at frame 6 (< 15) -> cancel-capable drop ->
    // no snapshot, no team flip; charA's new entry sees team=ground -> no fall
    testCharacters = [charSnapA]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      },
      {
        id: "e2",
        characterId: 52,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      },
    ]
    const result = runSimulation(entries, snapSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.pad.fall ??
        0,
    ).toBe(0)
  })

  it("non-cancel-capable same-char re-entry: pads to cover launch frame; footing fires -> fall on re-entry", () => {
    // charA swap at frame 0 -> pending footing at frame 15, trailing hit at frame 20
    // charA Normal Attack re-entry at frame 6 -> non-cancel-capable ->
    // pad = max(hitFrame=20, footingAtFrame=15) - 6 = 14; pendingFooting fires -> snapshot ->
    // on-field invariant promotes to air -> charA pays fall
    testCharacters = [charSnapA]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage.ground-stage::basic-attack",
        "e2",
      ),
    ]
    const result = runSimulation(entries, snapSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const reentry = actions.find((a) => a.sourceEntryId === "e2")
    expect(reentry?.delayBreakdown?.pad.fall).toBe(21)
    expect(reentry?.delayBreakdown?.pad.trailing).toBe(14)
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
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage.ground-stage::basic-attack",
        "e2",
      ),
    ]
    const result = runSimulation(entries, snapSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    // charB enters while charA's pending footing is still in the window (not yet fired)
    // -> charB sees ground -> no fall
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.pad.fall ??
        0,
    ).toBe(0)
    // trailing hit from charA fires via drainAll (1 immediate + 1 trailing = 2 total)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(2)
  })

  it("in-stage swap launch (launch <= advance): carried air still resets at window-end → ground (no fall)", () => {
    // swapFrames=20 makes {launch:15} an in-stage commit (15 <= advance 20): the
    // launch fires while charA is still on-field so the field flips to air, but the
    // air must ALSO ride on charA and reset at window-end. charB's 50-frame action
    // pushes charA's re-entry past window-end (frame 30) → the reset has already
    // grounded charA's carried footing → charA re-enters grounded, no fall.
    // (Before the fix, the in-stage case carried nothing and scheduled no reset, so
    // team footing stayed air and charA wrongly re-entered airborne → fall 21.)
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        53,
        "char.snap-b.basic-attack.ground-stage.ground-stage::basic-attack",
        "e2",
      ),
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage.ground-stage::basic-attack",
        "e3",
      ),
    ]
    const result = runSimulation(entries, snapSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 20,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e3")?.delayBreakdown?.pad.fall ??
        0,
    ).toBe(0)
  })

  it("in-stage swap launch: swap-back within window resumes air even after a teammate grounded the field (pays fall)", () => {
    // The core of the bug. swapFrames=20 → {launch:15} commits in-stage and the
    // field flips to air. charB then lands (non-swap {land:2}) which sets team
    // footing to ground. charA swaps back at ~frame 25, within its window (ends at
    // frame 30, so the window-end reset is cancelled). Because the air rides on
    // charA's own carried footing — not the (now grounded) team — charA resumes air
    // and pays fall on its grounded re-entry stage.
    // (Before the fix, the in-stage launch carried nothing, so charA read the
    // grounded team and wrongly re-entered on the ground → fall 0.)
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      {
        id: "e1",
        characterId: 52,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      },
      tlEntry(
        53,
        "char.snap-b.basic-attack.land-stage.land-stage::basic-attack",
        "e2",
      ),
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage.ground-stage::basic-attack",
        "e3",
      ),
    ]
    const result = runSimulation(entries, snapSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 20,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e3")?.delayBreakdown?.pad.fall,
    ).toBe(21)
  })

  it("air → { launch }: an airborne launch falls to ground first, then re-launches (pays fall)", () => {
    // charAerial launches (ground → air), then launches again while airborne. A
    // { launch } stage enters on the ground, so the airborne second launch falls
    // first → pays fall frames, then re-launches at its commit frame. computeFall
    // keys on the stage's ground *entry*, which { launch } has — not just "ground".
    testCharacters = [charAerial]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        "e1",
      ),
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        "e2",
      ),
    ]
    const result = runSimulation(entries, aerialSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.pad.fall,
    ).toBe(21)
  })

  it("Intro exception: a grounded Intro entered from an airborne field pays no fall", () => {
    // charAerial launches (field → air), then charB's grounded Intro takes the field.
    // A normal grounded stage would pay fall (airborne entry); an Intro ignores its
    // incoming footing and enters clean — no fall.
    testCharacters = [charAerial, charAerialB]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        "e1",
      ),
      tlEntry(
        51,
        "char.aerial-char-b.basic-attack.ground-intro.ground-intro-stage::basic-attack",
        "e2",
      ),
    ]
    const result = runSimulation(entries, aerialSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.pad.fall ??
        0,
    ).toBe(0)
  })

  it("Intro exception: an aerial Intro sets the field airborne; a following ground stage then falls", () => {
    // From a grounded field, charB's aerial Intro establishes air (it sets its own
    // footing regardless of what it entered on). Its next grounded stage then pays a
    // fall — proving the Intro drove team footing to air, not just ignored the check.
    testCharacters = [charAerialB]
    const entries: TimelineEntry[] = [
      tlEntry(
        51,
        "char.aerial-char-b.basic-attack.air-intro.air-intro-stage::basic-attack",
        "e1",
      ),
      tlEntry(
        51,
        "char.aerial-char-b.basic-attack.ground-attack.ground-stage::basic-attack",
        "e2",
      ),
    ]
    const result = runSimulation(entries, aerialSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    expect(
      actions.find((a) => a.sourceEntryId === "e1")?.delayBreakdown?.pad.fall ??
        0,
    ).toBe(0)
    expect(
      actions.find((a) => a.sourceEntryId === "e2")?.delayBreakdown?.pad.fall,
    ).toBe(21)
  })
})

describe("runSimulation — footing violation diagnostics", () => {
  const actionFor = (
    result: ReturnType<typeof runSimulation>,
    entryId: string,
  ): ActionEvent | undefined =>
    result.find(
      (e): e is ActionEvent =>
        e.kind === "action" && e.sourceEntryId === entryId,
    )

  it("grounded entry into a sustained-air stage executes with a footingViolation diagnostic", () => {
    testCharacters = [charAerial]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.basic-attack.aerial-attack.aerial-stage::basic-attack",
        "e1",
      ),
    ]
    const result = runSimulation(entries, aerialSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const action = actionFor(result, "e1")
    expect(action).toBeDefined()
    expect(action?.diagnostics).toHaveLength(1)
    expect(action?.diagnostics?.[0].kind).toBe("footingViolation")
    expect(action?.diagnostics?.[0].message).toContain("Launch/Jump required")
  })

  it("grounded entry into a { land } stage reports 'nothing to land from'", () => {
    testCharacters = [charSnapA, charSnapB]
    const entries: TimelineEntry[] = [
      tlEntry(
        52,
        "char.snap-a.basic-attack.land-stage.land-stage::basic-attack",
        "e1",
      ),
    ]
    const result = runSimulation(entries, snapSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const action = actionFor(result, "e1")
    expect(action?.diagnostics).toHaveLength(1)
    expect(action?.diagnostics?.[0].kind).toBe("footingViolation")
    expect(action?.diagnostics?.[0].message).toContain("Nothing to land from")
  })

  it("an air stage after a launch raises no diagnostic", () => {
    testCharacters = [charAerial]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        "e1",
      ),
      tlEntry(
        50,
        "char.aerial-char.basic-attack.aerial-attack.aerial-stage::basic-attack",
        "e2",
      ),
    ]
    const result = runSimulation(entries, aerialSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    expect(actionFor(result, "e1")?.diagnostics).toBeUndefined()
    expect(actionFor(result, "e2")?.diagnostics).toBeUndefined()
  })

  it("an aerial Intro from a grounded field is exempt (no diagnostic)", () => {
    testCharacters = [charAerial, charAerialB]
    const entries: TimelineEntry[] = [
      tlEntry(
        51,
        "char.aerial-char-b.basic-attack.air-intro.air-intro-stage::basic-attack",
        "e1",
      ),
    ]
    const result = runSimulation(entries, aerialSlots(), emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    expect(actionFor(result, "e1")?.diagnostics).toBeUndefined()
  })

  it("an insufficient-resource cast diagnostic reaches the ActionEvent", () => {
    const charLib: EnrichedCharacter = {
      ...charA,
      id: 60,
      name: "Lib Char",
      skills: [
        {
          id: 400,
          name: "Big Burst",
          type: "Resonance Liberation",
          stages: [
            {
              name: "Burst Stage",
              category: "Resonance Liberation",
              value: "100%",
              actionTime: 40,
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charLib]
    const entries: TimelineEntry[] = [
      tlEntry(
        60,
        "char.lib-char.resonance-liberation.big-burst.burst-stage::resonance-liberation",
        "e1",
      ),
    ]
    const result = runSimulation(entries, [60, null, null], emptyLoadouts, {
      reactionDelay: 0,
      swapFrames: 6,
      variantFloor: 0,
      fallFrames: 21,
    })
    const action = actionFor(result, "e1")
    expect(action?.diagnostics).toHaveLength(1)
    expect(action?.diagnostics?.[0].kind).toBe("insufficientEnergy")
  })
})
