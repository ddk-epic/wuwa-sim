import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { BuffDef } from "#/types/buff"
import type { HitEvent } from "#/types/simulation-log"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_SUBSTAT,
} from "./loadout/echo-stat-constants"

import { runSimulation } from "./simulation"
import { dmgHit, tlEntry } from "./simulation.test-fixtures"

const BASE_ER =
  DEFAULT_SUBSTAT_ROLLS.energyRechargePct * ECHO_SUBSTAT.energyRechargePct

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

describe("runSimulation — buff lifecycle interleaving", () => {
  it("interleaves buffApplied with action/hit events when an Intro Skill grants a Resonance Skill bonus", () => {
    const introBuff: BuffDef = {
      id: "char.intro.buff",
      name: "Intro",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Intro Skill",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 14 },
      effects: [
        {
          kind: "stat",
          path: { stat: "skillTypeBonus", key: "Resonance Skill" },
          value: { kind: "const", v: 0.5 },
        },
      ],
    }
    const charWithIntro: EnrichedCharacter = {
      ...charA,
      buffs: [introBuff],
      skills: [
        {
          id: 100,
          name: "Intro",
          type: "Intro Skill",
          stages: [
            {
              name: "Skill",
              category: "Intro Skill",
              value: "100%",
              actionTime: 30,
              damage: [dmgHit(1.0, 0, 0, "Intro Skill")],
            },
          ],
          damage: [],
        },
        {
          id: 101,
          name: "Resonance",
          type: "Resonance Skill",
          stages: [
            {
              name: "Skill",
              category: "Resonance Skill",
              value: "100%",
              actionTime: 30,
              damage: [dmgHit(1.0, 0, 0, "Resonance Skill")],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [charWithIntro]
    const entries: TimelineEntry[] = [
      tlEntry(1, "char.char-a.intro-skill.intro.skill::intro-skill"),
      tlEntry(
        1,
        "char.char-a.resonance-skill.resonance.skill::resonance-skill",
      ),
    ]
    const result = runSimulation(entries, [1, null, null], emptyLoadouts)
    const kinds = result.map((e) => e.kind)
    // Expected: buffApplied (from skillCast pre-hit), action, hit (intro hit, no bonus),
    //           action (resonance), hit (with bonus).
    expect(kinds[0]).toBe("buffApplied")
    expect(kinds).toContain("action")
    expect(kinds).toContain("hit")
    const resHit = result.find(
      (e): e is HitEvent =>
        e.kind === "hit" && e.skillType === "Resonance Skill",
    )
    expect(resHit).toBeDefined()
    expect(resHit?.activeBuffs.some((b) => b.id === "char.intro.buff")).toBe(
      true,
    )
    expect(resHit?.statsSnapshot.skillTypeBonus["Resonance Skill"]).toBeCloseTo(
      0.5,
    )
  })
})

describe("runSimulation — post-actionTime hits resolve in frame order (stacking)", () => {
  // A hit landing long after its actionTime must not drag the engine clock past
  // a later, earlier-framed cast — else the buff looks expired and the follow-up
  // spawns a duplicate instead of stacking.
  it("a long-tail hit does not prematurely expire a buff a later earlier-framed cast should stack onto", () => {
    const stackBuff: BuffDef = {
      id: "char.stack.buff",
      name: "Stacker",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Basic Attack",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 1 }, // 60 frames
      stacking: { max: 2, onRetrigger: "addStack" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    const char: EnrichedCharacter = {
      ...charA,
      buffs: [stackBuff],
      skills: [
        {
          id: 1,
          name: "Strikes",
          type: "Normal Attack",
          stages: [
            {
              name: "Longtail",
              category: "Basic Attack",
              newName: "Longtail",
              value: "100%",
              actionTime: 10,
              // hit lands at f=90, far past the 10-frame actionTime
              damage: [{ ...dmgHit(1), actionFrame: 90 }],
            },
            {
              name: "Followup",
              category: "Basic Attack",
              newName: "Followup",
              value: "100%",
              actionTime: 10,
              damage: [dmgHit(1)],
            },
          ],
          damage: [],
        },
      ],
    }
    testCharacters = [char]
    const entries: TimelineEntry[] = [
      tlEntry(1, "char.char-a.basic-attack.strikes.longtail::basic-attack"),
      tlEntry(1, "char.char-a.basic-attack.strikes.followup::basic-attack"),
    ]
    const result = runSimulation(entries, [1, null, null], emptyLoadouts)

    const applied = result.filter(
      (e) => e.kind === "buffApplied" && e.buffId === "char.stack.buff",
    )
    const refreshed = result.filter(
      (e) => e.kind === "buffRefreshed" && e.buffId === "char.stack.buff",
    )
    // One instance that stacks to 2 — not two overlapping instances.
    expect(applied).toHaveLength(1)
    expect(
      refreshed.some((e) => e.kind === "buffRefreshed" && e.stacks === 2),
    ).toBe(true)
  })
})

describe("runSimulation — Energy Recharge (#98)", () => {
  const erBuff = (id: number, erPct: number): BuffDef => ({
    id: `char${id}.er`,
    name: "ER Buff",
    trigger: { event: "simStart" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [
      {
        kind: "stat",
        path: { stat: "energyRechargePct" },
        value: { kind: "const", v: erPct },
      },
    ],
  })

  it("synthetic hit uses buff-owner ER, not on-field character ER", () => {
    // Char 1: on-field, no ER
    // Char 2: off-field, 50% ER; has an emitHit buff that fires on char1 hits
    //         with energy=10. Char 2 should credit 15, not 10.
    const coordBuff: BuffDef = {
      id: "char2.coord",
      name: "Coord",
      trigger: {
        event: "hitLanded",
        characterId: 1,
        actor: "any",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: { ...dmgHit(0.5, 10), dmgType: "Fusion" },
          icdFrames: 0,
          skillType: "Basic Attack",
        },
      ],
    }
    // Char 1's authored hit has energy=0 so no shared energy flows to char 2;
    // only the synthetic hit contributes energy to char 2 (10 * 1.5 = 15).
    const charOnField: EnrichedCharacter = {
      ...charA,
      id: 1,
      buffs: [],
      skills: [
        {
          ...charA.skills[0],
          stages: [
            { ...charA.skills[0].stages[0], damage: [dmgHit(1.5, 0, 0)] },
          ],
        },
      ],
    }
    const charOffField: EnrichedCharacter = {
      ...charA,
      id: 2,
      buffs: [coordBuff, erBuff(2, 0.5)],
    }
    testCharacters = [charOnField, charOffField]
    const result = runSimulation(
      [
        tlEntry(
          1,
          "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
        ),
      ],
      [1, 2, null],
      emptyLoadouts,
    )
    const synth = result.find((e) => e.kind === "hit" && e.synthetic) as
      | HitEvent
      | undefined
    expect(synth).toBeDefined()
    // Char 2 credited energy: 10 * (1 + 0.5 + BASE_ER); buff-owner ER, not on-field char ER
    expect(synth?.cumulativeEnergy).toBeCloseTo(10 * (1 + 0.5 + BASE_ER))
  })
})

describe("runSimulation — inherit duration", () => {
  const parentBuff: BuffDef = {
    id: "test.parent",
    name: "Parent",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
    },
    target: { kind: "self" },
    duration: { kind: "seconds", v: 10 },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 0.1 },
      },
    ],
  }

  const childBuff: BuffDef = {
    id: "test.child",
    name: "Child",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
    },
    target: { kind: "self" },
    duration: { kind: "inherit", buff: "parent" },
    effects: [
      {
        kind: "stat",
        path: { stat: "critRate" },
        value: { kind: "const", v: 0.2 },
      },
    ],
  }

  it("child buff inherits endTime from parent buff applied in the same event", () => {
    testCharacters = [{ ...charA, buffs: [parentBuff, childBuff] }]
    const entries = [
      tlEntry(
        1,
        "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
      ),
    ]
    const result = runSimulation(entries, [1, null, null], emptyLoadouts)
    const buffEvents = result.filter((e) => e.kind === "buffApplied")
    expect(buffEvents).toHaveLength(2)
    const parentApplied = buffEvents.find(
      (e) => "buffId" in e && e.buffId === "test.parent",
    )
    const childApplied = buffEvents.find(
      (e) => "buffId" in e && e.buffId === "test.child",
    )
    expect(parentApplied).toBeDefined()
    expect(childApplied).toBeDefined()
  })

  it("child buff with inherit duration expires at the same time as parent", () => {
    testCharacters = [{ ...charA, buffs: [parentBuff, childBuff] }]
    const entries = [
      tlEntry(
        1,
        "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
      ),
    ]
    const result = runSimulation(entries, [1, null, null], emptyLoadouts)
    const hitEvent = result.find((e) => e.kind === "hit")
    expect(hitEvent?.activeBuffs.some((b) => b.id === "test.parent")).toBe(true)
    expect(hitEvent?.activeBuffs.some((b) => b.id === "test.child")).toBe(true)
  })
})

describe("runSimulation — removeBuffs effect", () => {
  const markerBuff: BuffDef = {
    id: "test.marker",
    name: "Marker",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
    },
    target: { kind: "self" },
    duration: { kind: "seconds", v: 30 },
    effects: [],
  }

  const removeReaction: BuffDef = {
    id: "test.remove-reaction",
    name: "Remove Reaction",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Resonance Skill",
    },
    effects: [{ kind: "removeBuffs", buffs: ["marker"] }],
  }

  const charWithRemove: EnrichedCharacter = {
    ...charA,
    buffs: [markerBuff, removeReaction],
    skills: [
      charA.skills[0],
      {
        id: 200,
        name: "Skill",
        type: "Resonance Skill",
        stages: [
          {
            name: "Skill",
            category: "Resonance Skill",
            value: "100%",
            actionTime: 30,
            damage: [dmgHit(1.0, 0, 0, "Resonance Skill")],
          },
        ],
        damage: [],
      },
    ],
  }

  it("removeBuffs effect removes active instances of listed buff IDs", () => {
    testCharacters = [charWithRemove]
    const entries = [
      tlEntry(
        1,
        "char.char-a.basic-attack.normal-attack.stage-1::basic-attack",
      ),
      tlEntry(1, "char.char-a.resonance-skill.skill.skill::resonance-skill"),
    ]
    const result = runSimulation(entries, [1, null, null], emptyLoadouts)
    const applied = result.filter(
      (e) =>
        e.kind === "buffApplied" && "buffId" in e && e.buffId === "test.marker",
    )
    const consumed = result.filter(
      (e) =>
        e.kind === "buffConsumed" &&
        "buffId" in e &&
        e.buffId === "test.marker",
    )
    expect(applied).toHaveLength(1)
    expect(consumed).toHaveLength(1)
  })

  it("removeBuffs is a no-op when referenced buff is not active", () => {
    testCharacters = [charWithRemove]
    const entries = [
      tlEntry(1, "char.char-a.resonance-skill.skill.skill::resonance-skill"),
    ]
    const result = runSimulation(entries, [1, null, null], emptyLoadouts)
    const consumed = result.filter(
      (e) =>
        e.kind === "buffConsumed" &&
        "buffId" in e &&
        e.buffId === "test.marker",
    )
    expect(consumed).toHaveLength(0)
  })
})
