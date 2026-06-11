import { afterEach, describe, expect, it, vi } from "vitest"
import type { DamageEntry, EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { BuffDef } from "#/types/buff"
import type { ActionEvent, SimulationLogEntry } from "#/types/simulation-log"

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

const charVariant: EnrichedCharacter = {
  id: 10,
  name: "Variant Char",
  element: "Glacio",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 5,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage 5",
          category: "Basic Attack",
          value: "233.81%",
          actionTime: 50,
          variants: {
            cancel: { actionTime: 33 },
            instantCancel: { actionTime: 7 },
          },
          damage: [
            {
              type: "Basic Attack",
              dmgType: "Glacio",
              scalingStat: "ATK",
              actionFrame: 23,
              value: 2.3381,
              energy: 4.2,
              concerto: 10,
              toughness: 1.68,
              weakness: 1.344,
            },
          ],
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

describe("runSimulation — delayBreakdown on ActionEvent", () => {
  it("react-only: cancel variant sets react=reactionDelay, pad=0", () => {
    testCharacters = [charVariant]
    const entry: TimelineEntry = {
      id: "db1",
      characterId: 10,
      stageId: "char.variant-char.basic-attack.normal-attack._::basic-attack",
      variantKind: "cancel",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 6, 6)
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.delayBreakdown).toEqual({
      pad: { reaction: 6, floor: 0, trailing: 0, fall: 0 },
      wait: 0,
    })
  })

  it("no-delay: full stage has no delayBreakdown", () => {
    testCharacters = [charVariant]
    const entry = tlEntry(
      10,
      "char.variant-char.basic-attack.normal-attack._::basic-attack",
    )
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 6, 6)
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.delayBreakdown).toBeUndefined()
  })

  it("pad-only: non-cancel-capable re-entry after swap sets pad>0, react=0", () => {
    testCharacters = [charTrailingBase, charOtherTrailing]
    const entries: TimelineEntry[] = [
      {
        id: "db2",
        characterId: 30,
        stageId:
          "char.trailing-char.basic-attack.normal-attack._::basic-attack",
        variantKind: "swap",
      },
      {
        id: "db3",
        characterId: 31,
        stageId: "char.other-char.basic-attack.normal-attack._::basic-attack",
      },
      // Char 30 Basic Attack starts at frame 16, trailing hit at 30 -> padded to 30
      {
        id: "db4",
        characterId: 30,
        stageId:
          "char.trailing-char.basic-attack.normal-attack._::basic-attack",
      },
    ]
    const result = runSimulation(entries, [30, 31, null], emptyLoadouts, 6, 6)
    const padActions = result.filter(
      (e): e is ActionEvent => e.kind === "action",
    )
    const padAction = padActions.find(
      (a) => a.characterId === 30 && !a.variantKind,
    )
    // pad = 30 - 16 = 14
    expect(padAction?.delayBreakdown?.pad.trailing).toBe(14)
    expect(padAction?.delayBreakdown?.pad.reaction).toBe(0)
  })

  it("swap with authored actionTime: react=reactionDelay, pad=0 (no collision)", () => {
    const charWithSwap: EnrichedCharacter = {
      ...charVariant,
      id: 13,
      skills: [
        {
          id: 8,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage",
              category: "Basic Attack",
              value: "100%",
              actionTime: 50,
              variants: { swap: { actionTime: 10 } },
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charWithSwap]
    const entry: TimelineEntry = {
      id: "db5",
      characterId: 13,
      stageId: "char.variant-char.basic-attack.normal-attack._::basic-attack",
      variantKind: "swap",
    }
    const result = runSimulation([entry], emptySlots, emptyLoadouts, 6, 6)
    const action = result.find((e): e is ActionEvent => e.kind === "action")
    expect(action?.delayBreakdown).toEqual({
      pad: { reaction: 6, floor: 0, trailing: 0, fall: 0 },
      wait: 0,
    })
  })
})

describe("runSimulation — sourceEntryId (#186)", () => {
  it("authored hits carry sourceEntryId of their timeline entry", () => {
    testCharacters = [charA]
    const e1 = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack._::basic-attack",
      "entry-1",
    )
    const e2 = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack._::basic-attack",
      "entry-2",
    )
    const result = runSimulation([e1, e2], emptySlots, emptyLoadouts)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(2)
    expect(hits[0].sourceEntryId).toBe("entry-1")
    expect(hits[1].sourceEntryId).toBe("entry-2")
  })

  it("trailing-window hits carry sourceEntryId of the originating swap entry", () => {
    testCharacters = [charTrailingBase]
    const entries: TimelineEntry[] = [
      {
        id: "swap-entry",
        characterId: 30,
        stageId:
          "char.trailing-char.basic-attack.normal-attack._::basic-attack",
        variantKind: "swap",
      },
    ]
    const result = runSimulation(entries, [30, null, null], emptyLoadouts, 6, 6)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits.length).toBeGreaterThan(0)
    for (const hit of hits) {
      expect(hit.sourceEntryId).toBe("swap-entry")
    }
  })

  it("emitHit synthetic hits carry sourceEntryId of the triggering entry", () => {
    const coord: BuffDef = {
      id: "char.coord2",
      name: "Coord2",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: dmgHit(0.5),
          icdFrames: 0,
          skillType: "Basic Attack",
        },
      ],
    }
    const charWithCoord: EnrichedCharacter = { ...charA, buffs: [coord] }
    testCharacters = [charWithCoord]
    const entry = tlEntry(
      1,
      "char.char-a.basic-attack.normal-attack._::basic-attack",
      "trigger-entry",
    )
    const result = runSimulation([entry], [1, null, null], emptyLoadouts)
    const hits = result.filter((e) => e.kind === "hit")
    expect(hits).toHaveLength(2)
    for (const hit of hits) {
      expect(hit.sourceEntryId).toBe("trigger-entry")
    }
  })
})

describe("runSimulation — Swap-back Cooldown (#241)", () => {
  const swapBackCharA: EnrichedCharacter = {
    id: 50,
    name: "Swap A",
    element: "Fusion",
    weaponType: "Sword",
    rarity: "5",
    stats: {
      base: { hp: 0, atk: 0, def: 0 },
      max: { hp: 0, atk: 1000, def: 0 },
    },
    template: { weapon: "", echo: "", echoSet: "" },
    skillTreeBonuses: [],
    buffs: [],
    skills: [
      {
        id: 501,
        name: "Normal Attack",
        type: "Normal Attack",
        stages: [
          {
            name: "Stage 1",
            category: "Basic Attack",
            value: "100%",
            actionTime: 20,
            damage: [],
          },
        ],
        damage: [],
      },
    ],
  }
  const swapBackCharB: EnrichedCharacter = {
    ...swapBackCharA,
    id: 51,
    name: "Swap B",
  }
  const swapBackCharC: EnrichedCharacter = {
    ...swapBackCharA,
    id: 52,
    name: "Swap C",
    skills: [
      {
        id: 521,
        name: "Dodge",
        type: "Movement",
        stages: [
          {
            name: "Dodge",
            category: "Movement",
            value: "",
            actionTime: 10,
            damage: [],
          },
        ],
        damage: [],
      },
    ],
  }
  const slots50_51: Slots = [50, 51, null]

  function actionsFrom(log: SimulationLogEntry[]) {
    return log.filter((e): e is ActionEvent => e.kind === "action")
  }

  it("(a) clock starts at off-field-exit frame: full 60-frame cooldown on immediate swap-back", () => {
    // A (20f) -> B (20f) -> A: A left at frame 20, arrives back at frame 40 -> swapBack = 60 - 20 = 40
    testCharacters = [swapBackCharA, swapBackCharB]
    const entries = [
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e1",
      ),
      tlEntry(
        51,
        "char.swap-b.basic-attack.normal-attack._::basic-attack",
        "e2",
      ),
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e3",
      ),
    ]
    const log = runSimulation(entries, slots50_51, emptyLoadouts)
    const actions = actionsFrom(log)
    const reentry = actions.find((a) => a.sourceEntryId === "e3")
    expect(reentry?.delayBreakdown?.wait).toBe(40)
    // swapBack must advance the engine frame — re-entry actually starts at 40 + 40 = 80
    expect(reentry?.frame).toBe(80)
  })

  it("(b) trailing hits do not advance the clock: swapBack still reflects exit frame", () => {
    // A with trailing hits (actionTime=20, hit at frame 15) -> B (20f) -> A
    // A left at frame 20, B ends at frame 40, swapBack = 60 - 20 = 40
    testCharacters = [swapBackCharA, swapBackCharB]
    const charAWithTrailing: EnrichedCharacter = {
      ...swapBackCharA,
      skills: [
        {
          id: 501,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage 1",
              category: "Basic Attack",
              value: "100%",
              actionTime: 20,
              damage: [{ ...dmgHit(1.0), actionFrame: 15 }],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charAWithTrailing, swapBackCharB]
    const entries = [
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e1",
      ),
      tlEntry(
        51,
        "char.swap-b.basic-attack.normal-attack._::basic-attack",
        "e2",
      ),
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e3",
      ),
    ]
    const log = runSimulation(entries, slots50_51, emptyLoadouts)
    const actions = actionsFrom(log)
    const reentry = actions.find((a) => a.sourceEntryId === "e3")
    // A exited at frame 20, B ends at frame 40, swapBack = 60 - 20 = 40
    expect(reentry?.delayBreakdown?.wait).toBe(40)
  })

  it("(c) first-ever entry on a character has no swapBack", () => {
    testCharacters = [swapBackCharA]
    const entries = [
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e1",
      ),
    ]
    const log = runSimulation(entries, [50, null, null], emptyLoadouts)
    const actions = actionsFrom(log)
    expect(actions[0]?.delayBreakdown?.wait ?? 0).toBe(0)
  })

  it("(d) same-character successive entries skip swapBack (no swap fires)", () => {
    testCharacters = [swapBackCharA]
    const entries = [
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e1",
      ),
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e2",
      ),
    ]
    const log = runSimulation(entries, [50, null, null], emptyLoadouts)
    const actions = actionsFrom(log)
    expect(actions[1]?.delayBreakdown?.wait ?? 0).toBe(0)
  })

  it("(e) Movement stages do not affect the swap-back clock", () => {
    // A (20f) -> C:Dodge (10f) — no swap inferred for Movement -> B (20f) -> A
    // Because Dodge doesn't fire skillCast, A stays "on-field" in tracker;
    // B's arrival infers swap from A (sets lastOffFieldFrame[A] = 30), not C.
    // When A comes back at frame 50: swapBack = 60 - (50 - 30) = 40
    const charAMovement: EnrichedCharacter = { ...swapBackCharA, id: 50 }
    const charBMovement: EnrichedCharacter = { ...swapBackCharB, id: 51 }
    const charCMovement: EnrichedCharacter = { ...swapBackCharC, id: 52 }
    testCharacters = [charAMovement, charBMovement, charCMovement]
    const entries = [
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e1",
      ), // A at frame 0, ends frame 20
      tlEntry(52, "char.swap-c.movement.dodge._::movement", "e2"), // C:Dodge at frame 20, ends frame 30 (no swap inferred)
      tlEntry(
        51,
        "char.swap-b.basic-attack.normal-attack._::basic-attack",
        "e3",
      ), // B at frame 30, swap from A->B recorded (lastOffFieldFrame[A]=30)
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e4",
      ), // A at frame 50, swapBack = 60 - 20 = 40
    ]
    const log = runSimulation(entries, [50, 51, 52], emptyLoadouts)
    const actions = actionsFrom(log)
    const aReentry = actions.find((a) => a.sourceEntryId === "e4")
    expect(aReentry?.delayBreakdown?.wait).toBe(40)
  })

  it("(f) pad is 0 once 60+ frames have elapsed off-field", () => {
    // A (80f) -> B (20f) -> A: A left at frame 80, arrives at frame 100 -> 60 - 20 = 40; but if gap >= 60 -> 0
    // Use actionTime=70 for A so B starts at 70, then after B's 20f, A returns at 90 -> 60-(90-70)=40 (still some CD)
    // For gap >= 60: A's actionTime=80, B's actionTime=20 -> A returns at 100, 60-(100-80)=40 still partial
    // Use A actionTime=80, B actionTime=60: A exits at 80, B ends at 140 -> 60-(140-80) = 60-60 = 0
    const charALong: EnrichedCharacter = {
      ...swapBackCharA,
      skills: [
        {
          id: 501,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage 1",
              category: "Basic Attack",
              value: "100%",
              actionTime: 80,
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    }
    const charBLong: EnrichedCharacter = {
      ...swapBackCharB,
      skills: [
        {
          id: 511,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage 1",
              category: "Basic Attack",
              value: "100%",
              actionTime: 60,
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charALong, charBLong]
    const entries = [
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e1",
      ),
      tlEntry(
        51,
        "char.swap-b.basic-attack.normal-attack._::basic-attack",
        "e2",
      ),
      tlEntry(
        50,
        "char.swap-a.basic-attack.normal-attack._::basic-attack",
        "e3",
      ),
    ]
    const log = runSimulation(entries, slots50_51, emptyLoadouts)
    const actions = actionsFrom(log)
    const reentry = actions.find((a) => a.sourceEntryId === "e3")
    // A exits at frame 80, returns at frame 140 -> 60 - (140 - 80) = 0
    expect(reentry?.delayBreakdown?.wait ?? 0).toBe(0)
  })
})

describe("runSimulation — animationFrames: off-field clock advance", () => {
  // Char 60 has a normal 20-frame stage and a Liberation cast stage with animationFrames: 60
  const animCharA: EnrichedCharacter = {
    id: 60,
    name: "Anim A",
    element: "Fusion",
    weaponType: "Sword",
    rarity: "5",
    stats: {
      base: { hp: 0, atk: 0, def: 0 },
      max: { hp: 0, atk: 1000, def: 0 },
    },
    template: { weapon: "", echo: "", echoSet: "" },
    skillTreeBonuses: [],
    buffs: [],
    skills: [
      {
        id: 601,
        name: "Normal Attack",
        type: "Normal Attack",
        stages: [
          {
            name: "Stage 1",
            category: "Basic Attack",
            value: "100%",
            actionTime: 20,
            damage: [],
          },
        ],
        damage: [],
      },
      {
        id: 602,
        name: "Liberation",
        type: "Resonance Liberation",
        resonanceCost: 125,
        stages: [
          {
            name: "Skill DMG",
            category: "Resonance Liberation",
            newName: "Liberation",
            value: "",
            actionTime: 0,
            animationFrames: 60,
            damage: [],
          },
        ],
        damage: [],
      },
    ],
  }
  const animCharB: EnrichedCharacter = {
    ...animCharA,
    id: 61,
    name: "Anim B",
    skills: [
      {
        id: 611,
        name: "Normal Attack",
        type: "Normal Attack",
        stages: [
          {
            name: "Stage 1",
            category: "Basic Attack",
            value: "100%",
            actionTime: 20,
            damage: [],
          },
        ],
        damage: [],
      },
    ],
  }
  const slotsAB: Slots = [60, 61, null]

  function actionsFrom(log: SimulationLogEntry[]) {
    return log.filter((e): e is ActionEvent => e.kind === "action")
  }

  it("(a) caster's own residual CD is eaten by animationFrames", () => {
    // A swaps out at frame 20, B acts for 10 frames, A swaps back and casts Liberation
    // Without animation: swapBack = 60 - (30 - 20) = 50
    // With animation (60f): clock advances 60 before computing -> swapBack = 0
    testCharacters = [animCharA, animCharB]
    const charBShort: EnrichedCharacter = {
      ...animCharB,
      skills: [
        {
          id: 611,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage 1",
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
    testCharacters = [animCharA, charBShort]
    const entries = [
      tlEntry(
        60,
        "char.anim-a.basic-attack.normal-attack._::basic-attack",
        "e1",
      ), // A 0–20, A exits at 20
      tlEntry(
        61,
        "char.anim-b.basic-attack.normal-attack._::basic-attack",
        "e2",
      ), // B 20–30
      tlEntry(
        60,
        "char.anim-a.resonance-liberation.liberation.liberation::resonance-liberation",
        "e3",
      ), // A at frame 30, animationFrames=60 advance -> swapBack=0
    ]
    const log = runSimulation(entries, slotsAB, emptyLoadouts)
    const actions = actionsFrom(log)
    const liberation = actions.find((a) => a.sourceEntryId === "e3")
    expect(liberation?.delayBreakdown?.wait ?? 0).toBe(0)
  })

  it("(b) off-field teammate CD is eaten when caster uses animationFrames stage", () => {
    // B exits at frame 20, A casts Liberation at frame 20 (animationFrames=60)
    // Without animation: B's CD = 60 when B returns at frame 20
    // With animation: advance 60 -> B's CD = 0 when B returns at frame 20
    const charALib: EnrichedCharacter = {
      ...animCharA,
      skills: [
        animCharA.skills[1], // only Liberation
      ],
    }
    const charBNormal: EnrichedCharacter = {
      ...animCharB,
      skills: [
        {
          id: 611,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage 1",
              category: "Basic Attack",
              value: "100%",
              actionTime: 20,
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charALib, charBNormal]
    const entries = [
      tlEntry(
        61,
        "char.anim-b.basic-attack.normal-attack._::basic-attack",
        "e1",
      ), // B 0–20, B exits at 20
      tlEntry(
        60,
        "char.anim-a.resonance-liberation.liberation.liberation::resonance-liberation",
        "e2",
      ), // A at frame 20, animationFrames=60
      tlEntry(
        61,
        "char.anim-b.basic-attack.normal-attack._::basic-attack",
        "e3",
      ), // B returns: expects 0 swapBack
    ]
    const log = runSimulation(entries, slotsAB, emptyLoadouts)
    const actions = actionsFrom(log)
    const reentry = actions.find((a) => a.sourceEntryId === "e3")
    expect(reentry?.delayBreakdown?.wait ?? 0).toBe(0)
  })

  it("(c) sequential animations accumulate", () => {
    // B exits at frame 0. A casts two Liberations (animationFrames=60 each) -> total 120f advance
    // B re-enters at frame 0 -> swapBack = max(0, 60 - (0 - (0 - 120))) = 0
    const charADoubleLib: EnrichedCharacter = {
      ...animCharA,
      skills: [
        {
          id: 602,
          name: "Liberation",
          type: "Resonance Liberation",
          resonanceCost: 125,
          stages: [
            {
              name: "Skill DMG",
              category: "Resonance Liberation",
              newName: "Liberation",
              value: "",
              actionTime: 0,
              animationFrames: 60,
              damage: [],
            },
            {
              name: "Skill DMG",
              category: "Resonance Liberation",
              newName: "Liberation2",
              value: "",
              actionTime: 0,
              animationFrames: 60,
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charADoubleLib, animCharB]
    const entries = [
      tlEntry(
        61,
        "char.anim-b.basic-attack.normal-attack._::basic-attack",
        "e1",
      ), // B 0–20, B exits at 20
      tlEntry(
        60,
        "char.anim-a.resonance-liberation.liberation.liberation::resonance-liberation",
        "e2",
      ), // A at frame 20, +60 advance
      tlEntry(
        60,
        "char.anim-a.resonance-liberation.liberation.liberation2::resonance-liberation",
        "e3",
      ), // A at frame 20 still, +60 advance
      tlEntry(
        61,
        "char.anim-b.basic-attack.normal-attack._::basic-attack",
        "e4",
      ), // B returns at frame 20, 120f advance total -> 0
    ]
    const log = runSimulation(entries, slotsAB, emptyLoadouts)
    const actions = actionsFrom(log)
    const reentry = actions.find((a) => a.sourceEntryId === "e4")
    expect(reentry?.delayBreakdown?.wait ?? 0).toBe(0)
  })

  it("(d) non-animation entries do not advance off-field clocks", () => {
    // A exits at frame 20, B acts for 10 frames (no animationFrames), A returns at 30
    // swapBack = 60 - (30 - 20) = 50
    testCharacters = [animCharA, animCharB]
    const charBShort: EnrichedCharacter = {
      ...animCharB,
      skills: [
        {
          id: 611,
          name: "Normal Attack",
          type: "Normal Attack",
          stages: [
            {
              name: "Stage 1",
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
    testCharacters = [animCharA, charBShort]
    const entries = [
      tlEntry(
        60,
        "char.anim-a.basic-attack.normal-attack._::basic-attack",
        "e1",
      ), // A 0–20
      tlEntry(
        61,
        "char.anim-b.basic-attack.normal-attack._::basic-attack",
        "e2",
      ), // B 20–30
      tlEntry(
        60,
        "char.anim-a.basic-attack.normal-attack._::basic-attack",
        "e3",
      ), // A at 30, no animation
    ]
    const log = runSimulation(entries, slotsAB, emptyLoadouts)
    const actions = actionsFrom(log)
    const reentry = actions.find((a) => a.sourceEntryId === "e3")
    expect(reentry?.delayBreakdown?.wait ?? 0).toBe(50)
  })

  it("(e) stage without animationFrames does not advance clocks", () => {
    // Same as (d) but uses the Liberation stage with actionTime: 0 but NO animationFrames
    const charANoAnim: EnrichedCharacter = {
      ...animCharA,
      skills: [
        animCharA.skills[0],
        {
          id: 602,
          name: "Liberation",
          type: "Resonance Liberation",
          resonanceCost: 125,
          stages: [
            {
              name: "Skill DMG",
              category: "Resonance Liberation",
              newName: "Liberation",
              value: "",
              actionTime: 0,
              // no animationFrames
              damage: [],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charANoAnim, animCharB]
    const entries = [
      tlEntry(
        61,
        "char.anim-b.basic-attack.normal-attack._::basic-attack",
        "e1",
      ), // B 0–20, B exits at 20
      tlEntry(
        60,
        "char.anim-a.resonance-liberation.liberation.liberation::resonance-liberation",
        "e2",
      ), // A at 20, NO animation advance
      tlEntry(
        61,
        "char.anim-b.basic-attack.normal-attack._::basic-attack",
        "e3",
      ), // B at 20, swapBack = 60 - 0 = 60
    ]
    const log = runSimulation(entries, slotsAB, emptyLoadouts)
    const actions = actionsFrom(log)
    const reentry = actions.find((a) => a.sourceEntryId === "e3")
    expect(reentry?.delayBreakdown?.wait ?? 0).toBe(60)
  })
})
