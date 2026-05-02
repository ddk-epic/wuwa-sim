import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedWeapon } from "#/types/weapon"
import type { EnrichedEcho } from "#/types/echo"
import type { EchoSet } from "#/types/echo-set"
import type { BuffDef } from "#/types/buff"
import type { Slots, SlotLoadout } from "#/types/loadout"

import { BuffEngine } from "./buff-engine"

let testCharacters: EnrichedCharacter[] = []
let testWeapons: EnrichedWeapon[] = []
let testEchoes: EnrichedEcho[] = []
let testEchoSets: EchoSet[] = []

vi.mock("./catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getWeaponById: (id: number) => testWeapons.find((w) => w.id === id) ?? null,
  getEchoById: (id: number) => testEchoes.find((e) => e.id === id) ?? null,
  getEchoSetById: (id: number) => testEchoSets.find((s) => s.id === id) ?? null,
}))

afterEach(() => {
  testCharacters = []
  testWeapons = []
  testEchoes = []
  testEchoSets = []
})

const baseChar = (
  overrides: Partial<EnrichedCharacter> = {},
): EnrichedCharacter => ({
  id: 1,
  name: "Test",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [],
  ...overrides,
})

const slotsOf = (id: number): Slots => [id, null, null]
const emptyLoadout: SlotLoadout = {
  weaponId: null,
  echoId: null,
  echoSetId: null,
}

describe("BuffEngine.bootstrap — character-only", () => {
  it("returns base atk from character.stats.max.atk when no buffs are present", () => {
    testCharacters = [baseChar()]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.resolveStats(1).atkBase).toBe(1000)
  })

  it("applies a permanent stat buff from character.buffs", () => {
    const buff: BuffDef = {
      id: "char.test.atkPct",
      name: "Test ATK%",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    }
    testCharacters = [baseChar({ buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.resolveStats(1).atkPct).toBe(0.2)
  })
})

describe("BuffEngine.bootstrap — skill tree", () => {
  it("compiles 'Glacio DMG Bonus' to elementBonus", () => {
    testCharacters = [
      baseChar({ element: "Glacio", skillTreeBonuses: ["Glacio DMG Bonus"] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.resolveStats(1).elementBonus.Glacio).toBeCloseTo(0.12)
  })

  it("compiles 'ATK' to atkPct", () => {
    testCharacters = [baseChar({ skillTreeBonuses: ["ATK"] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.12)
  })

  it("stacks multiple skill tree nodes additively", () => {
    testCharacters = [
      baseChar({
        element: "Glacio",
        skillTreeBonuses: ["Glacio DMG Bonus", "ATK"],
      }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const stats = engine.resolveStats(1)
    expect(stats.elementBonus.Glacio).toBeCloseTo(0.12)
    expect(stats.atkPct).toBeCloseTo(0.12)
  })
})

describe("BuffEngine.bootstrap — weapon", () => {
  it("folds weapon main ATK and sub Crit. Rate into base stats", () => {
    testCharacters = [baseChar()]
    testWeapons = [
      {
        id: 100,
        name: "Test Sword",
        weaponType: "Sword",
        stats: {
          main: { name: "ATK", base: 0, max: 500 },
          sub: { name: "Crit. Rate", base: 0, max: 0.36 },
        },
        passive: { name: "" },
        buffs: [],
      },
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [
        { weaponId: 100, echoId: null, echoSetId: null },
        emptyLoadout,
        emptyLoadout,
      ],
    })
    const stats = engine.resolveStats(1)
    expect(stats.atkBase).toBe(1500)
    expect(stats.critRate).toBeCloseTo(0.36)
  })

  it("applies weapon passive buffs", () => {
    testCharacters = [baseChar()]
    testWeapons = [
      {
        id: 100,
        name: "Stringmaster-like",
        weaponType: "Rectifier",
        stats: {
          main: { name: "ATK", base: 0, max: 0 },
          sub: { name: "Crit. Rate", base: 0, max: 0 },
        },
        passive: { name: "" },
        buffs: [
          {
            id: "weapon.test.passive",
            name: "Passive",
            trigger: { event: "simStart" },
            target: { kind: "self" },
            duration: { kind: "permanent" },
            effects: [
              {
                kind: "stat",
                path: { stat: "atkPct" },
                value: { kind: "const", v: 0.12 },
              },
            ],
          },
        ],
      },
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [
        { weaponId: 100, echoId: null, echoSetId: null },
        emptyLoadout,
        emptyLoadout,
      ],
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.12)
  })
})

describe("BuffEngine.bootstrap — echo set piece filtering", () => {
  const setWithBoth: EchoSet = {
    id: 7,
    name: "Test Set",
    effects: [],
    buffs: [
      {
        id: "set.2pc",
        name: "2pc",
        trigger: { event: "simStart" },
        target: { kind: "self" },
        duration: { kind: "permanent" },
        requiresPieces: 2,
        effects: [
          {
            kind: "stat",
            path: { stat: "atkPct" },
            value: { kind: "const", v: 0.1 },
          },
        ],
      },
      {
        id: "set.5pc",
        name: "5pc",
        trigger: { event: "simStart" },
        target: { kind: "self" },
        duration: { kind: "permanent" },
        requiresPieces: 5,
        effects: [
          {
            kind: "stat",
            path: { stat: "critRate" },
            value: { kind: "const", v: 0.1 },
          },
        ],
      },
    ],
  }

  it("includes only 2pc when echoSetPieces=2", () => {
    testCharacters = [baseChar()]
    testEchoSets = [setWithBoth]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [
        { weaponId: null, echoId: null, echoSetId: 7 },
        emptyLoadout,
        emptyLoadout,
      ],
      echoSetPieces: [2],
    })
    const stats = engine.resolveStats(1)
    expect(stats.atkPct).toBeCloseTo(0.1)
    expect(stats.critRate).toBe(0)
  })

  it("includes both 2pc and 5pc when echoSetPieces=5", () => {
    testCharacters = [baseChar()]
    testEchoSets = [setWithBoth]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [
        { weaponId: null, echoId: null, echoSetId: 7 },
        emptyLoadout,
        emptyLoadout,
      ],
      echoSetPieces: [5],
    })
    const stats = engine.resolveStats(1)
    expect(stats.atkPct).toBeCloseTo(0.1)
    expect(stats.critRate).toBeCloseTo(0.1)
  })
})

describe("BuffEngine.bootstrap — sequence filtering", () => {
  it("excludes character buffs whose requiresSequence exceeds the loadout sequence", () => {
    const s2: BuffDef = {
      id: "char.s2",
      name: "S2 buff",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      requiresSequence: 2,
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.5 },
        },
      ],
    }
    testCharacters = [baseChar({ buffs: [s2] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
      sequences: [1],
    })
    expect(engine.resolveStats(1).atkPct).toBe(0)
  })

  it("includes character buffs whose requiresSequence is met", () => {
    const s2: BuffDef = {
      id: "char.s2",
      name: "S2 buff",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      requiresSequence: 2,
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.5 },
        },
      ],
    }
    testCharacters = [baseChar({ buffs: [s2] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
      sequences: [2],
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.5)
  })
})

describe("BuffEngine.bootstrap — collects from all four sources", () => {
  it("sums atkPct contributions from character, weapon, echo, and echo set", () => {
    const stat = (v: number, id: string): BuffDef => ({
      id,
      name: id,
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        { kind: "stat", path: { stat: "atkPct" }, value: { kind: "const", v } },
      ],
    })
    testCharacters = [baseChar({ buffs: [stat(0.05, "char")] })]
    testWeapons = [
      {
        id: 100,
        name: "W",
        weaponType: "Sword",
        stats: {
          main: { name: "ATK", base: 0, max: 0 },
          sub: { name: "Crit. Rate", base: 0, max: 0 },
        },
        passive: { name: "" },
        buffs: [stat(0.07, "weapon")],
      },
    ]
    testEchoes = [
      {
        id: 200,
        name: "E",
        cost: 4,
        element: "Fusion",
        set: "S",
        buffs: [stat(0.03, "echo")],
        skill: { cooldown: 0, description: "", stages: [] },
      },
    ]
    testEchoSets = [
      { id: 7, name: "S", effects: [], buffs: [stat(0.04, "set")] },
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [
        { weaponId: 100, echoId: 200, echoSetId: 7 },
        emptyLoadout,
        emptyLoadout,
      ],
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.05 + 0.07 + 0.03 + 0.04)
  })
})

describe("BuffEngine.onEvent — triggered buffs", () => {
  const skillCastBuff: BuffDef = {
    id: "char.intro",
    name: "Intro Buff",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillType: "Intro Skill",
    },
    target: { kind: "self" },
    duration: { kind: "seconds", v: 14 },
    effects: [
      {
        kind: "stat",
        path: { stat: "skillTypeBonus", key: "Resonance Skill" },
        value: { kind: "const", v: 0.38 },
      },
    ],
  }

  it("applies a buff when its skillCast trigger matches", () => {
    testCharacters = [baseChar({ id: 1, buffs: [skillCastBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.resolveStats(1).skillTypeBonus["Resonance Skill"] ?? 0).toBe(
      0,
    )
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Intro Skill",
      frame: 0,
    })
    expect(lifecycleEvents).toHaveLength(1)
    expect(lifecycleEvents[0]).toMatchObject({
      kind: "buffApplied",
      buffId: "char.intro",
      stacks: 1,
      targetCharacterId: 1,
    })
    expect(
      engine.resolveStats(1).skillTypeBonus["Resonance Skill"],
    ).toBeCloseTo(0.38)
  })

  it("does not apply when skillType does not match the trigger filter", () => {
    testCharacters = [baseChar({ id: 1, buffs: [skillCastBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    expect(lifecycleEvents).toEqual([])
  })

  it("emits buffRefreshed and bumps endTime when the same buff retriggers", () => {
    testCharacters = [baseChar({ id: 1, buffs: [skillCastBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Intro Skill",
      frame: 0,
    })
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Intro Skill",
      frame: 60,
    })
    expect(lifecycleEvents).toHaveLength(1)
    expect(lifecycleEvents[0]).toMatchObject({
      kind: "buffRefreshed",
      buffId: "char.intro",
    })
    // 14s = 840 frames. Original endTime would be 840 (apply at 0).
    // After refresh at frame 60, new endTime = 60 + 840 = 900.
    const expired = engine.tickToFrame(841)
    expect(expired.lifecycleEvents).toEqual([])
  })

  it("expires buffs at endTime via tickToFrame and emits buffExpired", () => {
    testCharacters = [baseChar({ id: 1, buffs: [skillCastBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Intro Skill",
      frame: 0,
    })
    const beforeExpiry = engine.tickToFrame(839)
    expect(beforeExpiry.lifecycleEvents).toEqual([])
    expect(
      engine.resolveStats(1).skillTypeBonus["Resonance Skill"],
    ).toBeCloseTo(0.38)
    const atExpiry = engine.tickToFrame(840)
    expect(atExpiry.lifecycleEvents).toHaveLength(1)
    expect(atExpiry.lifecycleEvents[0]).toMatchObject({
      kind: "buffExpired",
      buffId: "char.intro",
    })
    expect(engine.resolveStats(1).skillTypeBonus["Resonance Skill"] ?? 0).toBe(
      0,
    )
  })

  it("dedupes by (id, target): re-application from any source refreshes the same instance", () => {
    const teamBuff: BuffDef = {
      id: "ally.shared",
      name: "Shared",
      trigger: {
        event: "skillCast",
        actor: "any",
      },
      target: { kind: "self" },
      duration: { kind: "frames", v: 100 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [
      baseChar({ id: 1, buffs: [teamBuff] }),
      baseChar({ id: 2, buffs: [teamBuff] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // Both source 1 and source 2 self-apply on a generic skillCast — one instance per target.
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    const second = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 10,
    })
    // Second event re-triggers both buffs (one for each source) — both target=1, same id, so refresh.
    expect(
      second.lifecycleEvents.every((e) => e.kind === "buffRefreshed"),
    ).toBe(true)
  })

  it("hitLanded with no synthetic flag fires self-source triggers", () => {
    const onHit: BuffDef = {
      id: "char.onhit",
      name: "OnHit",
      trigger: { event: "hitLanded", characterId: 1 },
      target: { kind: "self" },
      duration: { kind: "frames", v: 60 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.05 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [onHit] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const { lifecycleEvents } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Damage",
      frame: 5,
    })
    expect(lifecycleEvents).toHaveLength(1)
    expect(lifecycleEvents[0].kind).toBe("buffApplied")
  })
})

describe("BuffEngine — implicit swap inference (#57)", () => {
  it("infers swapOut(prev) → swapIn(next) when skillCast actor changes", () => {
    const onSwapIn: BuffDef = {
      id: "char.b.onSwapIn",
      name: "On SwapIn",
      trigger: { event: "swapIn" },
      target: { kind: "self" },
      duration: { kind: "frames", v: 60 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    const onSwapOut: BuffDef = {
      id: "char.a.onSwapOut",
      name: "On SwapOut",
      trigger: { event: "swapOut" },
      target: { kind: "self" },
      duration: { kind: "frames", v: 60 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    }
    testCharacters = [
      baseChar({ id: 1, buffs: [onSwapOut] }),
      baseChar({ id: 2, buffs: [onSwapIn] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // First skillCast establishes on-field; should fire swapIn(1) only.
    const first = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    expect(first.lifecycleEvents).toEqual([])
    expect(engine.getOnFieldCharacterId()).toBe(1)

    // Switch to character 2 — should fire swapOut(1) (applies onSwapOut buff to 1)
    // and swapIn(2) (applies onSwapIn buff to 2).
    const second = engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Normal Attack",
      frame: 100,
    })
    expect(engine.getOnFieldCharacterId()).toBe(2)
    expect(second.lifecycleEvents.map((e) => e.buffId).sort()).toEqual([
      "char.a.onSwapOut",
      "char.b.onSwapIn",
    ])
  })
})

describe("BuffEngine — nextOnField deferred resolution (#57)", () => {
  it("materializes a nextOnField buff at the next swapIn", () => {
    const outro: BuffDef = {
      id: "char.a.outro",
      name: "Outro",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Outro Skill",
      },
      target: { kind: "nextOnField" },
      duration: { kind: "seconds", v: 14 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [outro] }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })

    // Establish on-field as 1
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    // Cast outro: trigger fires but nothing materializes yet.
    const outroFire = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Outro Skill",
      frame: 50,
    })
    expect(outroFire.lifecycleEvents).toEqual([])
    expect(engine.pendingNextOnFieldCount()).toBe(1)
    expect(engine.resolveStats(2).atkPct).toBe(0)

    // Swap to character 2 — materialize on 2.
    const swap = engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Normal Attack",
      frame: 60,
    })
    const applied = swap.lifecycleEvents.find(
      (e) => e.kind === "buffApplied" && e.buffId === "char.a.outro",
    )
    expect(applied).toBeDefined()
    expect(applied?.targetCharacterId).toBe(2)
    expect(engine.resolveStats(2).atkPct).toBeCloseTo(0.3)
  })
})

describe("BuffEngine — condition gating (#57)", () => {
  it("onField condition: instance present but does not contribute when target is off-field", () => {
    const buff: BuffDef = {
      id: "char.a.onfield-only",
      name: "OnField Only",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      condition: { kind: "onField" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.4 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // Permanent + conditional -> stays live, doesn't bake in. Before any swap, on-field is null.
    expect(engine.resolveStats(1).atkPct).toBe(0)

    // Bring 1 on-field
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.4)

    // Swap to 2; 1 is off-field — buff still in active list but does not contribute.
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Normal Attack",
      frame: 50,
    })
    expect(engine.resolveStats(1).atkPct).toBe(0)
  })
})

describe("BuffEngine — expiresOnSourceSwapOut (#57)", () => {
  it("removes instances whose source character swaps out", () => {
    const buff: BuffDef = {
      id: "char.a.tied-to-source",
      name: "Tied",
      trigger: { event: "skillCast", characterId: 1 },
      target: { kind: "team" },
      duration: { kind: "frames", v: 1000 },
      expiresOnSourceSwapOut: true,
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.15 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // 1 swaps in and casts (applies team buff)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.15)
    expect(engine.resolveStats(2).atkPct).toBeCloseTo(0.15)

    // Swap to 2 — source 1 swaps out, instances expire.
    const swap = engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Normal Attack",
      frame: 100,
    })
    const expired = swap.lifecycleEvents.filter(
      (e) => e.kind === "buffExpired" && e.buffId === "char.a.tied-to-source",
    )
    expect(expired.length).toBe(2)
    expect(engine.resolveStats(1).atkPct).toBe(0)
    expect(engine.resolveStats(2).atkPct).toBe(0)
  })
})

describe("BuffEngine — resource state (#58)", () => {
  it("accumulates energy and concerto from hitLanded events on the actor", () => {
    testCharacters = [baseChar({ id: 1 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 5,
      concerto: 2,
    })
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Damage",
      frame: 10,
      energy: 3,
      concerto: 1,
    })
    expect(engine.getResource(1).energy).toBe(8)
    expect(engine.getResource(1).concerto).toBe(3)
  })

  it("accumulates skillCast concerto into the actor's resource state", () => {
    testCharacters = [baseChar({ id: 1 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Heavy Attack",
      frame: 0,
      concerto: 15,
    })
    expect(engine.getResource(1).concerto).toBe(15)
  })

  it("resourceAtLeast condition gates contribution", () => {
    const buff: BuffDef = {
      id: "char.high-energy",
      name: "High Energy",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      condition: {
        kind: "resourceAtLeast",
        resource: "energy",
        n: 100,
        on: "target",
      },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.25 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.resolveStats(1).atkPct).toBe(0)
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Damage",
      frame: 0,
      energy: 100,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.25)
  })

  it("resourceCrossed trigger fires once when the threshold is crossed upward", () => {
    const onConcerto100: BuffDef = {
      id: "char.concerto-ready",
      name: "Concerto Ready",
      trigger: {
        event: "resourceCrossed",
        resource: "concerto",
        threshold: 100,
        direction: "up",
      },
      target: { kind: "self" },
      duration: { kind: "frames", v: 1000 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [onConcerto100] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // Below threshold — no fire.
    const a = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 50,
    })
    expect(
      a.lifecycleEvents.find((e) => e.buffId === "char.concerto-ready"),
    ).toBeUndefined()
    // Crosses 100 — fires once.
    const b = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Damage",
      frame: 10,
      concerto: 60,
    })
    const applied = b.lifecycleEvents.filter(
      (e) => e.buffId === "char.concerto-ready" && e.kind === "buffApplied",
    )
    expect(applied).toHaveLength(1)
    // Further upward gain does not fire again (would need to cross again).
    const c = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Damage",
      frame: 20,
      concerto: 10,
    })
    const fired = c.lifecycleEvents.filter(
      (e) => e.buffId === "char.concerto-ready" && e.kind === "buffApplied",
    )
    expect(fired).toHaveLength(0)
  })

  it("warns when Resonance Liberation casts with insufficient energy but still dispatches", () => {
    testCharacters = [baseChar({ id: 1, name: "Test Character" })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Liberation",
      frame: 0,
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain("Test Character")
    expect(warn.mock.calls[0][0]).toContain("0")
    warn.mockRestore()
  })
})

describe("BuffEngine — stacking policies (#59)", () => {
  const makeStackingBuff = (
    onRetrigger:
      | "refresh"
      | "addStack"
      | "addStackKeepTimer"
      | "ignore"
      | "replace",
    max = 3,
  ): BuffDef => ({
    id: "char.stacker",
    name: "Stacker",
    trigger: { event: "skillCast", characterId: 1, skillType: "Normal Attack" },
    target: { kind: "self" },
    duration: { kind: "frames", v: 100 },
    stacking: { max, onRetrigger },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 0.1 },
      },
    ],
  })

  const fire = (engine: BuffEngine, frame: number) =>
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame,
    })

  it("addStack: increments stacks up to max, resets endTime", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [makeStackingBuff("addStack", 3)] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    fire(engine, 0)
    fire(engine, 10)
    const third = fire(engine, 20)
    expect(third.lifecycleEvents[0]).toMatchObject({
      kind: "buffRefreshed",
      stacks: 3,
    })
    // 4th application is capped at max=3
    const fourth = fire(engine, 30)
    expect(fourth.lifecycleEvents[0]).toMatchObject({ stacks: 3 })
    // endTime resets to 30 + 100 = 130; before that, no expire
    expect(engine.tickToFrame(129).lifecycleEvents).toEqual([])
    expect(engine.tickToFrame(130).lifecycleEvents).toHaveLength(1)
  })

  it("addStackKeepTimer: increments stacks but preserves original endTime", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [makeStackingBuff("addStackKeepTimer", 3)] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    fire(engine, 0) // endTime = 100
    fire(engine, 50) // stacks = 2, endTime stays 100
    expect(engine.tickToFrame(99).lifecycleEvents).toEqual([])
    const expired = engine.tickToFrame(100)
    expect(expired.lifecycleEvents).toHaveLength(1)
    expect(expired.lifecycleEvents[0]).toMatchObject({
      kind: "buffExpired",
      stacks: 2,
    })
  })

  it("ignore: re-application is a no-op while active", () => {
    testCharacters = [baseChar({ id: 1, buffs: [makeStackingBuff("ignore")] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const first = fire(engine, 0)
    expect(first.lifecycleEvents[0]).toMatchObject({ kind: "buffApplied" })
    const second = fire(engine, 50)
    expect(second.lifecycleEvents).toEqual([])
    // endTime unchanged at 100
    const expired = engine.tickToFrame(100)
    expect(expired.lifecycleEvents).toHaveLength(1)
  })

  it("replace: removes existing (buffExpired) and applies fresh (stacks=1)", () => {
    const buff = makeStackingBuff("replace")
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    fire(engine, 0)
    const second = fire(engine, 50)
    expect(second.lifecycleEvents.map((e) => e.kind)).toEqual([
      "buffExpired",
      "buffApplied",
    ])
    expect(second.lifecycleEvents[1]).toMatchObject({ stacks: 1 })
    // endTime should be 50 + 100 = 150
    expect(engine.tickToFrame(149).lifecycleEvents).toEqual([])
    expect(engine.tickToFrame(150).lifecycleEvents).toHaveLength(1)
  })

  it("default stacking is { max: 1, onRetrigger: 'refresh' } when omitted", () => {
    const buff: BuffDef = {
      id: "char.default",
      name: "Default",
      trigger: { event: "skillCast", characterId: 1 },
      target: { kind: "self" },
      duration: { kind: "frames", v: 100 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    fire(engine, 0)
    const second = fire(engine, 30)
    expect(second.lifecycleEvents[0]).toMatchObject({
      kind: "buffRefreshed",
      stacks: 1,
    })
  })
})

describe("BuffEngine — perStack ValueExpr (#59)", () => {
  const perStackBuff: BuffDef = {
    id: "char.frost-marks",
    name: "Frost Marks",
    trigger: { event: "skillCast", characterId: 1, skillType: "Normal Attack" },
    target: { kind: "self" },
    duration: { kind: "frames", v: 600 },
    stacking: { max: 4, onRetrigger: "addStack" },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "perStack", v: 0.05 },
      },
    ],
  }

  it("contribution scales with current stack count, recomputed on read", () => {
    testCharacters = [baseChar({ id: 1, buffs: [perStackBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.05)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 10,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.1)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 20,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.15)
  })

  it("snapshot:true freezes value at apply time even as stacks later change", () => {
    const snap: BuffDef = {
      ...perStackBuff,
      id: "char.snap-perstack",
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.05, snapshot: true },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [snap] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // First application: stacks=1 at apply, snapshot freezes at 0.05.
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.05)
    // Stack growth via addStack — frozen snapshot ignores new stacks.
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 10,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 20,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.05)
  })

  it("const snapshot is symmetrical (value frozen identically to non-snapshot)", () => {
    const buff: BuffDef = {
      id: "char.const-snap",
      name: "Const Snap",
      trigger: { event: "skillCast", characterId: 1 },
      target: { kind: "self" },
      duration: { kind: "frames", v: 100 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2, snapshot: true },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.2)
  })

  it("replace re-snapshots at the new apply time", () => {
    const buff: BuffDef = {
      id: "char.replace-snap",
      name: "Replace Snap",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Normal Attack",
      },
      target: { kind: "self" },
      duration: { kind: "frames", v: 100 },
      stacking: { max: 1, onRetrigger: "replace" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.07, snapshot: true },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.07)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 50,
    })
    // Replace creates a fresh instance with stacks=1 → snapshot stays at 0.07.
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.07)
  })
})

describe("BuffEngine.resolveStats — fallback", () => {
  it("returns base atk for known character not in any slot", () => {
    testCharacters = [baseChar()]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [null, null, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.resolveStats(1).atkBase).toBe(1000)
  })
})
