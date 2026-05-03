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

describe("BuffEngine — emitHit (#60)", () => {
  const dmg = (
    overrides: Partial<{
      value: number
      dmgType: string
      energy: number
      concerto: number
    }> = {},
  ) => ({
    type: "ATK",
    dmgType: "Fusion",
    scalingStat: "atk",
    actionFrame: 0,
    value: 1.0,
    energy: 0,
    concerto: 0,
    toughness: 0,
    weakness: 0,
    ...overrides,
  })

  const coordOnHit = (
    overrides: Partial<BuffDef> = {},
    icdFrames = 60,
  ): BuffDef => ({
    id: "char.coord",
    name: "Coord",
    trigger: { event: "hitLanded", characterId: 1, source: "self" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [
      {
        kind: "emitHit",
        damage: dmg({ value: 0.5, dmgType: "Fusion" }),
        icdFrames,
      },
    ],
    ...overrides,
  })

  it("emits a synthetic hit when an emitHit-bearing buff is triggered", () => {
    testCharacters = [baseChar({ id: 1, buffs: [coordOnHit()] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(result.syntheticHits).toHaveLength(1)
    expect(result.syntheticHits[0]).toMatchObject({
      kind: "hit",
      synthetic: true,
      sourceBuffId: "char.coord",
      characterId: 1,
      frame: 0,
    })
    // damage = 0.5 * 1000 * DEF_MULT(0.5) * RES_MULT(0.9) = 225
    expect(result.syntheticHits[0].damage).toBe(225)
  })

  it("ICD prevents firing again before icdFrames elapse, then re-fires", () => {
    testCharacters = [baseChar({ id: 1, buffs: [coordOnHit({}, 60)] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const a = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(a.syntheticHits).toHaveLength(1)
    const b = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Fusion",
      frame: 30,
    })
    expect(b.syntheticHits).toHaveLength(0)
    const c = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Fusion",
      frame: 60,
    })
    expect(c.syntheticHits).toHaveLength(1)
  })

  it("default hitLanded triggers ignore synthetic hits (no chain reaction)", () => {
    // Two buffs: A is the coord-attack source (emits on Normal Attack).
    // B is a default `hitLanded` trigger that would chain emitHits if it caught synthetics.
    const a = coordOnHit({ id: "a.coord" }, 1)
    const b: BuffDef = {
      id: "b.chained",
      name: "Chained",
      trigger: { event: "hitLanded", characterId: 1 },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg({ value: 1.0 }), icdFrames: 1 }],
    }
    testCharacters = [baseChar({ id: 1, buffs: [a, b] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    // Both a and b fire on the original hit (depth 0). Their synthetics fire
    // hitLanded(synthetic=true). Default `source: "self"` means neither matches
    // the synthetic hitLanded — so no chain.
    expect(result.syntheticHits).toHaveLength(2)
  })

  it("synthetic-opt-in triggers chain off synthetic hits up to depth cap of 8", () => {
    const chainer: BuffDef = {
      id: "char.chainer",
      name: "Chainer",
      trigger: { event: "hitLanded", characterId: 1, source: "any" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg({ value: 0.1 }), icdFrames: 0 }],
    }
    testCharacters = [baseChar({ id: 1, buffs: [chainer] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    // Original event triggers the buff once (depth 0 → emit synthetic at depth 1).
    // That synthetic fires a hitLanded(synthetic) which the buff also matches
    // (source: "any"), emitting again at depth 2, ... up to depth 8. Depth 9
    // is rejected with a warning. Total synthetics emitted = 8.
    expect(result.syntheticHits).toHaveLength(8)
    expect(warn).toHaveBeenCalled()
    expect(warn.mock.calls[0][0]).toContain("emitHit chain depth exceeded")
    warn.mockRestore()
  })

  it("synthetic hit does not change on-field state", () => {
    const buff: BuffDef = {
      id: "char.field-flip",
      name: "Field flip",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg({ value: 1.0 }), icdFrames: 0 }],
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] }), baseChar({ id: 2 })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Normal Attack",
      frame: 0,
    })
    expect(engine.getOnFieldCharacterId()).toBe(1)
    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Fusion",
      frame: 5,
    })
    // Synthetic hit attributed to 1 (acting). On-field stays 1 (not flipped).
    expect(engine.getOnFieldCharacterId()).toBe(1)
  })

  it("synthetic damage uses the acting character's stats (source-side element bonus)", () => {
    // Source 1 has +50% Fusion bonus; the on-field character (2) does not.
    // Coord attack should reflect 1's bonus in the synthetic hit's damage.
    const elemBuff: BuffDef = {
      id: "char.fusion-bonus",
      name: "Fusion +50%",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.5 },
        },
      ],
    }
    const coord: BuffDef = {
      id: "char.coord",
      name: "Coord",
      trigger: { event: "hitLanded", characterId: 2, actor: "any" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: dmg({ value: 1.0, dmgType: "Fusion" }),
          icdFrames: 0,
        },
      ],
    }
    testCharacters = [
      baseChar({
        id: 1,
        element: "Fusion",
        buffs: [elemBuff, coord],
      }),
      baseChar({ id: 2 }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    // 2 lands a hit; 1 (off-field) emits a synthetic.
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 2,
      skillType: "Normal Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(result.syntheticHits).toHaveLength(1)
    // Without the +50% Fusion: 1.0 * 1000 * 0.5 * 0.9 = 450.
    // With the +50%: 450 * 1.5 = 675.
    expect(result.syntheticHits[0].damage).toBe(675)
    expect(result.syntheticHits[0].characterId).toBe(1)
  })

  it("phase pipeline: lex tiebreak by buffDef.id is deterministic", () => {
    const z: BuffDef = {
      id: "z.coord",
      name: "Z",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg({ value: 0.1 }), icdFrames: 0 }],
    }
    const a: BuffDef = {
      id: "a.coord",
      name: "A",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [{ kind: "emitHit", damage: dmg({ value: 0.1 }), icdFrames: 0 }],
    }
    // Insertion order: z first, a second — output should still be a, then z.
    testCharacters = [baseChar({ id: 1, buffs: [z, a] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(result.syntheticHits.map((h) => h.sourceBuffId)).toEqual([
      "a.coord",
      "z.coord",
    ])
  })

  it("synthetic hits accumulate energy/concerto on the source character", () => {
    const buff: BuffDef = {
      id: "char.coord",
      name: "Coord",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "emitHit",
          damage: dmg({ value: 1.0, energy: 4, concerto: 3 }),
          icdFrames: 0,
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
      kind: "hitLanded",
      characterId: 1,
      skillType: "Normal Attack",
      dmgType: "Fusion",
      frame: 0,
      energy: 5,
      concerto: 2,
    })
    // Authored: +5 energy / +2 concerto. Synthetic: +4 energy / +3 concerto.
    expect(engine.getResource(1).energy).toBe(9)
    expect(engine.getResource(1).concerto).toBe(5)
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

describe("BuffEngine — consumedBy (#61)", () => {
  const guaranteedCrit: BuffDef = {
    id: "char.next-basic-crit",
    name: "Next Basic Guaranteed Crit",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
    },
    target: { kind: "self" },
    duration: { kind: "frames", v: 600 },
    effects: [
      {
        kind: "stat",
        path: { stat: "critRate" },
        value: { kind: "const", v: 1 },
      },
    ],
    consumedBy: {
      event: "hitLanded",
      skillType: "Basic Attack",
      source: "self",
    },
  }

  it("removes the instance and emits buffConsumed when consumedBy matches", () => {
    testCharacters = [baseChar({ id: 1, buffs: [guaranteedCrit] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 0,
    })
    expect(engine.resolveStats(1).critRate).toBe(1)
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 30,
    })
    const consumed = result.lifecycleEvents.find(
      (e) => e.kind === "buffConsumed",
    )
    expect(consumed).toMatchObject({
      kind: "buffConsumed",
      buffId: "char.next-basic-crit",
      targetCharacterId: 1,
      stacks: 0,
      frame: 30,
    })
    expect(engine.resolveStats(1).critRate).toBe(0)
  })

  it("does not consume when the event does not match the filter", () => {
    testCharacters = [baseChar({ id: 1, buffs: [guaranteedCrit] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 0,
    })
    const result = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Heavy Attack",
      dmgType: "Fusion",
      frame: 30,
    })
    expect(result.lifecycleEvents.some((e) => e.kind === "buffConsumed")).toBe(
      false,
    )
    expect(engine.resolveStats(1).critRate).toBe(1)
  })

  it("decrements stacks without removing while stacks remain >0", () => {
    const stackedConsumable: BuffDef = {
      id: "char.three-shot",
      name: "Three Shot",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Resonance Skill",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      stacking: { max: 3, onRetrigger: "addStack" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: 0.1 },
        },
      ],
      consumedBy: {
        event: "hitLanded",
        skillType: "Basic Attack",
        source: "self",
      },
    }
    testCharacters = [baseChar({ id: 1, buffs: [stackedConsumable] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 1,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 2,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.3)

    const r1 = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 10,
    })
    expect(r1.lifecycleEvents.some((e) => e.kind === "buffConsumed")).toBe(
      false,
    )
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.2)

    engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 20,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.1)

    const r3 = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 30,
    })
    expect(r3.lifecycleEvents.some((e) => e.kind === "buffConsumed")).toBe(true)
    expect(engine.resolveStats(1).atkPct).toBe(0)
  })

  it("runs after emitHit so the buff contributes to the triggering hit", () => {
    // A guaranteed-crit buff plus an emitHit synthetic. The synthetic hit
    // should resolve with the buff still active (consume runs after emitHit).
    const buff: BuffDef = {
      id: "char.crit-and-emit",
      name: "Crit + Emit",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "critRate" },
          value: { kind: "const", v: 1 },
        },
        {
          kind: "emitHit",
          damage: {
            type: "ATK",
            dmgType: "Fusion",
            scalingStat: "atk",
            actionFrame: 0,
            value: 0.5,
            energy: 0,
            concerto: 0,
            toughness: 0,
            weakness: 0,
          },
          icdFrames: 0,
        },
      ],
      consumedBy: { event: "hitLanded", source: "self", actor: "any" },
    }
    testCharacters = [baseChar({ id: 1, buffs: [buff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const r = engine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillType: "Basic Attack",
      dmgType: "Fusion",
      frame: 0,
    })
    expect(r.syntheticHits).toHaveLength(1)
    expect(r.lifecycleEvents.some((e) => e.kind === "buffConsumed")).toBe(true)
  })
})

describe("BuffEngine — perSource (#61)", () => {
  const sharedBuff = (perSource: boolean): BuffDef => ({
    id: "team.shared",
    name: "Shared",
    trigger: { event: "skillCast", actor: "any", skillType: "Resonance Skill" },
    target: { kind: "team" },
    duration: { kind: "frames", v: 300 },
    perSource,
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 0.2 },
      },
    ],
  })

  it("default (perSource=false) refreshes a single instance from any source", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [sharedBuff(false)] }),
      baseChar({ id: 2, name: "B", buffs: [sharedBuff(false)] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Resonance Skill",
      frame: 1,
    })
    // Single instance, only +0.2 contribution.
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.2)
    expect(engine.activeBuffIds(1)).toEqual(["team.shared"])
  })

  it("perSource=true produces parallel instances summing contributions", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [sharedBuff(true)] }),
      baseChar({ id: 2, name: "B", buffs: [sharedBuff(true)] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1, 2, null],
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillType: "Resonance Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 2,
      skillType: "Resonance Skill",
      frame: 1,
    })
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.4)
    expect(engine.activeBuffIds(1)).toEqual(["team.shared", "team.shared"])
  })
})

describe("BuffEngine — nonStackingGroup (#61)", () => {
  it("logs console.info when multiple buffs in the same group are co-active", () => {
    const a: BuffDef = {
      id: "buff.a",
      name: "A",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      condition: { kind: "onField" },
      nonStackingGroup: "atk-up",
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    }
    const b: BuffDef = {
      ...a,
      id: "buff.b",
      name: "B",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Normal Attack",
      },
      duration: { kind: "frames", v: 600 },
      condition: undefined,
    }
    testCharacters = [baseChar({ id: 1, buffs: [a, b] })]
    const engine = new BuffEngine()
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    try {
      engine.bootstrap({
        slots: slotsOf(1),
        loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
      })
      // Trigger b — a is already active from sim start, so this should warn.
      engine.onEvent({
        kind: "skillCast",
        characterId: 1,
        skillType: "Normal Attack",
        frame: 0,
      })
      expect(info).toHaveBeenCalled()
      const msg = String(info.mock.calls[0][0])
      expect(msg).toContain("atk-up")
      expect(msg).toContain("buff.a")
      expect(msg).toContain("buff.b")
    } finally {
      info.mockRestore()
    }
  })

  it("does not log when only one buff in the group is active", () => {
    const a: BuffDef = {
      id: "buff.a",
      name: "A",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillType: "Normal Attack",
      },
      target: { kind: "self" },
      duration: { kind: "frames", v: 600 },
      nonStackingGroup: "atk-up",
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [a] })]
    const engine = new BuffEngine()
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    try {
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
      expect(info).not.toHaveBeenCalled()
    } finally {
      info.mockRestore()
    }
  })
})
