// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { WeaponData } from "#/types/weapon"
import type { EnrichedEcho } from "#/types/echo"
import type { EchoSet } from "#/types/echo-set"
import type { BuffDef } from "#/types/buff"
import { BuffEngine } from "./buff-engine"
import {
  BASE_ATK_PCT,
  baseChar,
  emptyLoadout,
  slotsOf,
} from "./buff-engine.test-fixtures"

let testCharacters: EnrichedCharacter[] = []
let testWeapons: WeaponData[] = []
let testEchoes: EnrichedEcho[] = []
let testEchoSets: EchoSet[] = []

vi.mock("../loadout/catalog", () => ({
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

describe("BuffEngine.onEvent — triggered buffs", () => {
  const skillCastBuff: BuffDef = {
    id: "char.intro",
    name: "Intro Buff",
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
    expect(engine.resolveStats(1).skillTypeBonus["Resonance Skill"]).toBe(0)
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Intro Skill",
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
      skillCategory: "Basic Attack",
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
      skillCategory: "Intro Skill",
      frame: 0,
    })
    const { lifecycleEvents } = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Intro Skill",
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
      skillCategory: "Intro Skill",
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
    expect(engine.resolveStats(1).skillTypeBonus["Resonance Skill"]).toBe(0)
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
      skillCategory: "Basic Attack",
      frame: 0,
    })
    const second = engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
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
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 5,
    })
    expect(lifecycleEvents).toHaveLength(1)
    expect(lifecycleEvents[0].kind).toBe("buffApplied")
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

describe("BuffEngine — phase pipeline as data", () => {
  it("a stat Effect in a later phase sees Resource State mutated by an earlier phase", () => {
    // Two buffs trigger off the same skillCast event.
    //   - resourceBuff fires in the resource phase, adding 50 concerto.
    //   - statBuff fires in the stat phase (applyBuff). It carries a stat
    //     effect (+0.5 atkPct) gated by a Condition resourceAtLeast(concerto, 50).
    // Because the resource phase runs first, statBuff's Condition is satisfied
    // when resolveStats later reads concerto, and the +0.5 contribution lands.
    // Buff ids ensure resourceBuff's id sorts BEFORE statBuff's id so that,
    // even within a single phase, candidates are processed in the pinned
    // lex order.
    const resourceBuff: BuffDef = {
      id: "char.test.a-resource",
      name: "Adds Concerto",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Basic Attack",
      },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "resource",
          resource: "concerto",
          op: "add",
          value: { kind: "const", v: 50 },
          target: "self",
        },
      ],
    }
    const statBuff: BuffDef = {
      id: "char.test.b-stat",
      name: "Conditional ATK%",
      trigger: {
        event: "skillCast",
        characterId: 1,
        skillCategory: "Basic Attack",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      condition: {
        kind: "resourceAtLeast",
        resource: "concerto",
        n: 50,
        on: "source",
      },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.5 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [resourceBuff, statBuff] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.getResource(1).concerto).toBe(0)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(BASE_ATK_PCT)

    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })

    expect(engine.getResource(1).concerto).toBe(50)
    expect(engine.resolveStats(1).atkPct).toBeCloseTo(0.5 + BASE_ATK_PCT)
  })
})

describe("BuffEngine — resolveHit + recordHit (deep seam, #67)", () => {
  it("resolveHit then recordHit is equivalent to tickToFrame + resolveStats + onEvent + getResource", () => {
    const trigger: BuffDef = {
      id: "char.hit.bonus",
      name: "Hit Bonus",
      trigger: { event: "hitLanded", characterId: 1, source: "self" },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 5 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    }
    testCharacters = [baseChar({ id: 1, buffs: [trigger] })]

    const oldEngine = new BuffEngine()
    oldEngine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const oldTick = oldEngine.tickToFrame(30)
    const oldStats = oldEngine.resolveStats(1)
    const oldActiveBuffIds = oldEngine.activeBuffIds(1)
    const oldDispatch = oldEngine.onEvent({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 30,
      energy: 5,
      concerto: 2,
    })
    const oldPostState = oldEngine.getResource(1)

    const newEngine = new BuffEngine()
    newEngine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const resolved = newEngine.resolveHit(1, 30)
    const dispatch = newEngine.recordHit({
      kind: "hitLanded",
      characterId: 1,
      skillCategory: "Basic Attack",
      dmgType: "Fusion",
      frame: 30,
      energy: 5,
      concerto: 2,
    })

    expect(resolved.lifecycleEvents).toEqual(oldTick.lifecycleEvents)
    expect(resolved.stats).toEqual(oldStats)
    expect(resolved.activeBuffs.map((b) => b.id).sort()).toEqual(
      oldActiveBuffIds,
    )
    expect(dispatch.lifecycleEvents).toEqual(oldDispatch.lifecycleEvents)
    expect(dispatch.deferredEmits).toEqual(oldDispatch.deferredEmits)
    expect(dispatch.postState).toEqual(oldPostState)
  })
})

describe("BuffEngine.passiveBuffs", () => {
  const passiveBuff = (id: string, name: string): BuffDef => ({
    id,
    name,
    trigger: { event: "simStart" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 0.1 },
      },
    ],
  })

  it("returns empty array when character has no folded buffs", () => {
    testCharacters = [baseChar({ id: 1, buffs: [] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.passiveBuffs(1)).toEqual([])
  })

  it("returns folded buffs as ActiveBuff entries with stacks:1", () => {
    testCharacters = [
      baseChar({
        id: 1,
        buffs: [
          passiveBuff("skill-tree.atk", "ATK"),
          passiveBuff("weapon.amp", "Amplification"),
        ],
      }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    expect(engine.passiveBuffs(1)).toEqual([
      { id: "skill-tree.atk", name: "ATK", stacks: 1 },
      { id: "weapon.amp", name: "Amplification", stacks: 1 },
    ])
  })

  it("does not include conditional passives (permanentInstances) in passiveBuffs", () => {
    testCharacters = [
      baseChar({
        id: 1,
        buffs: [
          passiveBuff("skill-tree.atk", "ATK"),
          {
            ...passiveBuff("weapon.conditional", "Conditional"),
            condition: { kind: "actorIsOffField" },
          },
        ],
      }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const ids = engine.passiveBuffs(1).map((b) => b.id)
    expect(ids).toEqual(["skill-tree.atk"])
  })

  it("resolveHit includes passiveBuffs matching passiveBuffs()", () => {
    testCharacters = [
      baseChar({
        id: 1,
        buffs: [passiveBuff("echo-set.molten-2pc", "Molten Rift (2pc)")],
        skills: [],
      }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    const resolved = engine.resolveHit(1, 0)
    expect(resolved.passiveBuffs).toEqual(engine.passiveBuffs(1))
  })
})

describe("BuffEngine.onEvent — buffExpired trigger", () => {
  const gate: BuffDef = {
    id: "char.gate",
    name: "Gate",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Intro Skill",
    },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [],
  }

  const remover: BuffDef = {
    id: "char.remover",
    name: "Remover",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
    },
    effects: [{ kind: "removeBuffs", buffs: ["gate"] }],
  }

  const reactor: BuffDef = {
    id: "char.reactor",
    name: "Reactor",
    trigger: { event: "buffExpired", buff: "gate" },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [],
  }

  it("fires a buff whose trigger is buffExpired when the named buff is removed", () => {
    testCharacters = [baseChar({ id: 1, buffs: [gate, remover, reactor] })]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Intro Skill",
      frame: 0,
    })
    expect(engine.activeBuffIds(1)).toContain("char.gate")
    expect(engine.activeBuffIds(1)).not.toContain("char.reactor")

    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 30,
    })
    expect(engine.activeBuffIds(1)).not.toContain("char.gate")
    expect(engine.activeBuffIds(1)).toContain("char.reactor")
  })

  const timed: BuffDef = {
    id: "char.timed",
    name: "Timed",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Intro Skill",
    },
    target: { kind: "self" },
    duration: { kind: "frames", v: 100 },
    effects: [],
  }

  const dependent: BuffDef = {
    id: "char.dependent",
    name: "Dependent",
    trigger: {
      event: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
    },
    target: { kind: "self" },
    duration: { kind: "permanent" },
    effects: [],
  }

  const timerReactor: BuffDef = {
    id: "char.timer-reactor",
    name: "Timer Reactor",
    trigger: { event: "buffExpired", buff: "timed" },
    effects: [{ kind: "removeBuffs", buffs: ["dependent"] }],
  }

  it("fires a buffExpired dependent when a timed buff expires via tickToFrame", () => {
    testCharacters = [
      baseChar({ id: 1, buffs: [timed, dependent, timerReactor] }),
    ]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: slotsOf(1),
      loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Intro Skill",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1,
      skillCategory: "Basic Attack",
      frame: 0,
    })
    expect(engine.activeBuffIds(1)).toEqual(
      expect.arrayContaining(["char.timed", "char.dependent"]),
    )

    const { lifecycleEvents } = engine.tickToFrame(100)
    expect(lifecycleEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "buffExpired", buffId: "char.timed" }),
        expect.objectContaining({
          kind: "buffConsumed",
          buffId: "char.dependent",
        }),
      ]),
    )
    expect(engine.activeBuffIds(1)).not.toContain("char.timed")
    expect(engine.activeBuffIds(1)).not.toContain("char.dependent")
  })
})
