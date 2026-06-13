import { afterEach, describe, expect, it, vi } from "vitest"
import type { DamageEntry, EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { BuffDef } from "#/types/buff"
import type { ActionEvent, HitEvent } from "#/types/simulation-log"

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

const emptySlots: Slots = [null, null, null]
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

const trailingHit = (actionFrame: number): DamageEntry => ({
  type: "Basic Attack",
  dmgType: "Damage",
  scalingStat: "ATK",
  actionFrame,
  value: 1.0,
  energy: 0,
  concerto: 0,
  toughness: 0,
  weakness: 0,
})

const charTrailingBase: EnrichedCharacter = {
  id: 30,
  name: "Trailing Char",
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
      id: 200,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage",
          category: "Basic Attack",
          value: "100%",
          actionTime: 50,
          damage: [trailingHit(3), trailingHit(15), trailingHit(30)],
        },
      ],
      damage: [],
    },
    {
      id: 201,
      name: "Resonance Skill",
      type: "Resonance Skill",
      stages: [
        {
          name: "Stage",
          category: "Resonance Skill",
          value: "100%",
          actionTime: 40,
          damage: [],
        },
      ],
      damage: [],
    },
    {
      id: 202,
      name: "Movement",
      type: "Movement",
      stages: [
        {
          name: "Stage",
          category: "Movement",
          value: "0",
          actionTime: 5,
          damage: [],
        },
      ],
      damage: [],
    },
  ],
}

const charOtherTrailing: EnrichedCharacter = {
  id: 31,
  name: "Other Char",
  element: "Glacio",
  weaponType: "Sword",
  rarity: "5",
  maxEnergy: 100,
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 210,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage",
          category: "Basic Attack",
          value: "100%",
          actionTime: 10,
          damage: [],
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
  ],
}

describe("runSimulation — Movement stages", () => {
  const charWithMovement: EnrichedCharacter = {
    id: 99,
    name: "Movement Char",
    element: "Fusion",
    weaponType: "Sword",
    rarity: "5",
    maxEnergy: 100,
    stats: {
      base: { hp: 0, atk: 0, def: 0 },
      max: { hp: 0, atk: 1000, def: 0 },
    },
    template: { weapon: "", echo: "", echoSet: "" },
    skillTreeBonuses: [],
    buffs: [],
    skills: [
      {
        id: 991,
        name: "Normal Attack",
        type: "Normal Attack",
        stages: [
          {
            name: "Stage 1",
            category: "Basic Attack",
            value: "100%",
            actionTime: 60,
            damage: [dmgHit(1.5, 10, 5)],
          },
        ],
        damage: [],
      },
      {
        id: 992,
        name: "Dodge",
        type: "Movement",
        stages: [
          {
            name: "Dodge",
            category: "Movement",
            value: "",
            actionTime: 21,
            damage: [],
          },
        ],
        damage: [],
      },
    ],
  }

  it("Dodge produces an Action Event in the log", () => {
    testCharacters = [charWithMovement]
    const result = runSimulation(
      [tlEntry(99, "char.movement-char.movement.dodge.dodge::movement")],
      emptySlots,
      emptyLoadouts,
    )
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action).toBeDefined()
    expect(action?.skillType).toBe("Movement")
    expect(action?.frame).toBe(0)
  })

  it("Dodge produces only an Action Event — no hit events", () => {
    testCharacters = [charWithMovement]
    const result = runSimulation(
      [tlEntry(99, "char.movement-char.movement.dodge.dodge::movement")],
      emptySlots,
      emptyLoadouts,
    )
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(0)
  })

  it("concerto stays unchanged across a Dodge (no skillCast dispatch)", () => {
    testCharacters = [charWithMovement]
    const result = runSimulation(
      [
        tlEntry(
          99,
          "char.movement-char.basic-attack.normal-attack.stage-1::basic-attack",
        ), // gains concerto from hit
        tlEntry(99, "char.movement-char.movement.dodge.dodge::movement"),
      ],
      emptySlots,
      emptyLoadouts,
    )
    // After Normal Attack hits: concerto accumulated; the Dodge action event shows
    // the same concerto (Dodge did not apply any concerto delta)
    const hits = result.filter((e): e is HitEvent => e.kind === "hit")
    const hitAfterNormal = hits[0]
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const dodgeAction = actions.find((a) => a.skillType === "Movement")
    expect(hitAfterNormal.cumulativeConcerto).toBeGreaterThan(0)
    expect(dodgeAction?.cumulativeConcerto).toBe(
      hitAfterNormal.cumulativeConcerto,
    )
  })

  it("energy is preserved across a Dodge (Liberation energy not drained)", () => {
    testCharacters = [charWithMovement]
    const result = runSimulation(
      [
        tlEntry(
          99,
          "char.movement-char.basic-attack.normal-attack.stage-1::basic-attack",
        ), // accumulates energy via hit
        tlEntry(99, "char.movement-char.movement.dodge.dodge::movement"),
      ],
      emptySlots,
      emptyLoadouts,
    )
    // Energy set by the hit event; the Dodge action event must show same value
    const hits = result.filter((e): e is HitEvent => e.kind === "hit")
    const hitAfterNormal = hits[0]
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const dodgeAction = actions.find((a) => a.skillType === "Movement")
    expect(hitAfterNormal.cumulativeEnergy).toBeGreaterThan(0)
    expect(dodgeAction?.cumulativeEnergy).toBe(hitAfterNormal.cumulativeEnergy)
  })

  it("skillCast-triggered buff does not promote when Dodge is cast", () => {
    const skillCastBuff: BuffDef = {
      id: "test.on-cast",
      name: "On Cast Buff",
      trigger: {
        event: "skillCast",
        characterId: 99,
        skillCategory: "Movement",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.5 },
        },
      ],
    }
    const charWithBuff: EnrichedCharacter = {
      ...charWithMovement,
      buffs: [skillCastBuff],
    }
    testCharacters = [charWithBuff]
    const result = runSimulation(
      [tlEntry(99, "char.movement-char.movement.dodge.dodge::movement")],
      emptySlots,
      emptyLoadouts,
    )
    const buffEvents = result.filter((e) => e.kind === "buffApplied")
    expect(buffEvents).toHaveLength(0)
  })
})

describe("runSimulation — trailing-window collision", () => {
  it("cancel-capable re-entry: drops trailing hits at or after new-entry start frame", () => {
    testCharacters = [charTrailingBase]
    const entries: TimelineEntry[] = [
      {
        id: "t1",
        characterId: 30,
        stageId:
          "char.trailing-char.basic-attack.normal-attack.stage::basic-attack",
        variantKind: "swap",
      },
      // Resonance Skill starts at frame 6; trailing hits at 15 and 30 >= 6 -> dropped
      {
        id: "t2",
        characterId: 30,
        stageId:
          "char.trailing-char.resonance-skill.resonance-skill.stage::resonance-skill",
      },
    ]
    const result = runSimulation(entries, [30, null, null], emptyLoadouts, 6, 6)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(1) // only immediate hit at frame 3 survives
    expect(hits[0].frame).toBe(3)
  })

  it("non-cancel-capable re-entry: pads frame to last trailing hit; all trailing hits land", () => {
    testCharacters = [charTrailingBase, charOtherTrailing]
    const entries: TimelineEntry[] = [
      // Char 30 swap: advance=6, trailing hits at hitFrames 15 and 30
      {
        id: "t1",
        characterId: 30,
        stageId:
          "char.trailing-char.basic-attack.normal-attack.stage::basic-attack",
        variantKind: "swap",
      },
      // Char 31: advance=10, frame -> 6+10=16
      {
        id: "t2",
        characterId: 31,
        stageId:
          "char.other-char.basic-attack.normal-attack.stage::basic-attack",
      },
      // Char 30 full (non-cancel-capable): would start at 16, but trailing hit 30 >= 16 -> pad to 30
      {
        id: "t3",
        characterId: 30,
        stageId:
          "char.trailing-char.basic-attack.normal-attack.stage::basic-attack",
      },
    ]
    const result = runSimulation(entries, [30, 31, null], emptyLoadouts, 6, 6)
    const actions = result.filter((e) => e.kind === "action")
    // t3 action: trailing-window pad to 30 + swapBack 36 (char 30 off-field since frame 6) = 66
    const t3Action = actions.find((a) => a.characterId === 30 && !a.variantKind)
    expect(t3Action?.frame).toBe(66)
    // All trailing hits from t1 appear in log
    const hits = result.filter(
      (e): e is HitEvent => e.kind === "hit" && e.characterId === 30,
    )
    const hitFrames = hits.map((h) => h.frame).sort((a, b) => a - b)
    expect(hitFrames).toContain(15)
    expect(hitFrames).toContain(30)
  })
})

describe("runSimulation — fall frames", () => {
  it("same-character air->ground: fall fires on grounded stage after launch", () => {
    testCharacters = [charAerial]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        "e1",
      ),
      tlEntry(
        50,
        "char.aerial-char.basic-attack.ground-attack.ground-stage::basic-attack",
        "e2",
      ),
    ]
    // reactionDelay=0, swapFrames=6, variantFloor=0, fallFrames=21
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
    const groundAction = actions.find((a) => a.sourceEntryId === "e2")
    expect(groundAction?.delayBreakdown?.pad.fall).toBe(21)
  })

  it("same-character ground stage after ground stage: fall does not fire", () => {
    testCharacters = [charAerial]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.basic-attack.ground-attack.ground-stage::basic-attack",
        "e1",
      ),
      tlEntry(
        50,
        "char.aerial-char.basic-attack.ground-attack.ground-stage::basic-attack",
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
    const second = actions.find((a) => a.sourceEntryId === "e2")
    expect(second?.delayBreakdown?.pad.fall ?? 0).toBe(0)
  })

  it("aerial stage after launch: fall does not fire (air->air)", () => {
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
    const aerialAction = actions.find((a) => a.sourceEntryId === "e2")
    expect(aerialAction?.delayBreakdown?.pad.fall ?? 0).toBe(0)
  })

  it("cross-character air->ground via swap: fall fires on incoming character's row", () => {
    testCharacters = [charAerial, charAerialB]
    // charA launches (team -> air), charB does ground stage (fall fires on charB)
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
    const charBAction = actions.find((a) => a.sourceEntryId === "e2")
    expect(charBAction?.delayBreakdown?.pad.fall).toBe(21)
  })

  it("fall is additive with pad (both non-zero)", () => {
    // charA full non-swap launch -> team air; charB swap with trailing hit -> window;
    // charB re-enters ground stage: fall fires (team air) + pad fires (trailing hit)
    testCharacters = [charAerial, charSnapA]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        "e1",
      ), // non-swap: {launch:15} <= advance=30 -> on-field -> team=air
      {
        id: "e2",
        characterId: 52,
        stageId:
          "char.snap-a.resonance-skill.aerial-swap.aerial-swap-stage::resonance-skill",
        variantKind: "swap",
      }, // trailing hit at hitFrame=30+20=50; pendingFooting atFrame=30+15=45; swap advance=6
      tlEntry(
        52,
        "char.snap-a.basic-attack.ground-stage.ground-stage::basic-attack",
        "e3",
      ), // charB re-enters at frame 36
    ]
    const result = runSimulation(
      entries,
      [50, 52, null],
      emptyLoadouts,
      0,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const charBReentry = actions.find((a) => a.sourceEntryId === "e3")
    // fall=21 (team air from charA's launch + pending footing snapshot promotes)
    expect(charBReentry?.delayBreakdown?.pad.fall).toBe(21)
    // pad is non-zero (trailing hit at frame 50 extends entry starting at 36)
    expect(charBReentry?.delayBreakdown?.pad.trailing ?? 0).toBeGreaterThan(0)
  })

  it("fall is NOT subject to variantFloor (fall accumulates independently)", () => {
    testCharacters = [charAerial]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        "e1",
      ),
      {
        id: "e2",
        characterId: 50,
        stageId:
          "char.aerial-char.basic-attack.ground-attack.ground-stage::basic-attack",
        variantKind: "cancel",
      },
    ]
    // variantFloor=30, fallFrames=21 — fall should be 21 regardless of floor=30
    const result = runSimulation(
      entries,
      aerialSlots(),
      emptyLoadouts,
      0,
      6,
      30,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const groundAction = actions.find((a) => a.sourceEntryId === "e2")
    expect(groundAction?.delayBreakdown?.pad.fall).toBe(21)
  })

  it("react/floor mutex preserved alongside fall", () => {
    testCharacters = [charAerial]
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        "e1",
      ),
      {
        id: "e2",
        characterId: 50,
        stageId:
          "char.aerial-char.basic-attack.ground-attack.ground-stage::basic-attack",
        variantKind: "cancel",
      },
    ]
    // reactionDelay=6, variantFloor=0 -> react wins
    const result = runSimulation(
      entries,
      aerialSlots(),
      emptyLoadouts,
      6,
      6,
      0,
      21,
    )
    const actions = result.filter((e): e is ActionEvent => e.kind === "action")
    const groundAction = actions.find((a) => a.sourceEntryId === "e2")
    expect(groundAction?.delayBreakdown?.pad.reaction).toBe(6)
    expect(groundAction?.delayBreakdown?.pad.floor).toBe(0)
    expect(groundAction?.delayBreakdown?.pad.fall).toBe(21)
  })

  it("footing-transparent stage does not reset footing cursor", () => {
    testCharacters = [charAerial]
    // launch -> neutral (transparent, no footing change) -> ground -> fall fires
    const entries: TimelineEntry[] = [
      tlEntry(
        50,
        "char.aerial-char.resonance-skill.launch.launch-stage::resonance-skill",
        "e1",
      ),
      tlEntry(
        50,
        "char.aerial-char.basic-attack.neutral.neutral-stage::basic-attack",
        "e2",
      ),
      tlEntry(
        50,
        "char.aerial-char.basic-attack.ground-attack.ground-stage::basic-attack",
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
    const groundAction = actions.find((a) => a.sourceEntryId === "e3")
    expect(groundAction?.delayBreakdown?.pad.fall).toBe(21)
  })
})
