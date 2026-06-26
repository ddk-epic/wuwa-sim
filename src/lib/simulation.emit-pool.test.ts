// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type {
  ActionEvent,
  HitEvent,
  SimulationLogEntry,
} from "#/types/simulation-log"

import { runSimulation } from "./simulation"
import { dmgHit, makeChar, stageOf, tlEntry } from "./simulation.test-fixtures"

/**
 * Emit Pool tracer: a hit carrying `spawn: N` pushes N Deferred Emits onto the
 * actor's pool; each matures `maturation` frames later into a Synthetic Hit
 * landing at `convertFrame + emit.actionFrame`, and the pool count tracks.
 */

const MATURATION = 100
const TRAVEL = 40

/** A pool character whose Basic Attack spawns `spawn` cores, optionally capped. */
const poolChar = (spawn: number, cap?: number): EnrichedCharacter => {
  const char = makeChar(1, "Pool A")
  char.emitPool = {
    name: "Pool Emit",
    ...(cap !== undefined ? { cap } : {}),
    maturation: MATURATION,
    emit: { ...dmgHit(2.0), actionFrame: TRAVEL },
  }
  char.skills[0].stages[0].damage = [{ ...dmgHit(1.0), spawn }]
  return char
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

const isPoolSynth = (e: SimulationLogEntry): e is HitEvent =>
  e.kind === "hit" && e.synthetic === true && e.sourceBuffId === "emitPool"

describe("Emit Pool tracer — spawn to maturation", () => {
  it("each spawned core matures into a synthetic hit at maturation + travel", () => {
    testCharacters = [poolChar(2)]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [tlEntry(1, stageOf("pool-a"), "e1")],
      slots,
      loadouts,
    )
    const synths = log.filter(isPoolSynth)
    // Hit at frame 0 spawns 2 → both mature at 100 → land at 100 + 40.
    expect(synths).toHaveLength(2)
    expect(synths.map((s) => s.frame)).toEqual([
      MATURATION + TRAVEL,
      MATURATION + TRAVEL,
    ])
    expect(synths[0].multiplier).toBe(2.0)
  })

  it("pool count is visible on a later action and clears once matured", () => {
    testCharacters = [poolChar(2)]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [
        tlEntry(1, stageOf("pool-a"), "e1"),
        tlEntry(1, stageOf("pool-a"), "e2"),
      ],
      slots,
      loadouts,
    )
    const actions = log.filter((e): e is ActionEvent => e.kind === "action")
    // e1's action precedes its own spawning hit, so the pool is still empty.
    expect(actions[0].pool).toBeUndefined()
    // e2 acts at frame 60, before e1's cores mature at 100: 2 in flight.
    expect(actions[1].pool).toBe(2)

    // 2 cores per hit, 2 hits → 4 synthetics; counts never desync.
    const synths = log.filter(isPoolSynth)
    expect(synths).toHaveLength(4)
    expect(synths.filter((s) => s.frame === MATURATION + TRAVEL)).toHaveLength(
      2,
    )
    expect(
      synths.filter((s) => s.frame === 60 + MATURATION + TRAVEL),
    ).toHaveLength(2)
  })

  it("a still-pending maturation resolves at end of run", () => {
    testCharacters = [poolChar(1)]
    const slots: Slots = [1, null, null]
    // No later authored action: the maturation only resolves in the final drain.
    const log = runSimulation(
      [tlEntry(1, stageOf("pool-a"), "e1")],
      slots,
      loadouts,
    )
    const synths = log.filter(isPoolSynth)
    expect(synths).toHaveLength(1)
    expect(synths[0].frame).toBe(MATURATION + TRAVEL)
  })
})

// Long enough that prior cores are still pending when the convert fires.
const CONVERT_MATURATION = 300
const RESONANCE_STAGE =
  "char.pool-a.resonance-skill.resonance-skill.stage-1::resonance-skill"

/** A pool character whose Resonance Skill cast converts `count` held cores. */
const convertChar = (count: number | "all"): EnrichedCharacter => {
  const char = makeChar(1, "Pool A")
  char.emitPool = {
    name: "Pool Emit",
    maturation: CONVERT_MATURATION,
    emit: { ...dmgHit(2.0), actionFrame: TRAVEL },
  }
  char.skills[0].stages[0].damage = [{ ...dmgHit(1.0), spawn: 1 }]
  char.skills.push({
    id: 11,
    name: "Resonance Skill",
    type: "Resonance Skill",
    stages: [
      {
        name: "Stage 1",
        category: "Resonance Skill",
        value: "100%",
        actionTime: 60,
        damage: [dmgHit(0.5, 0, 0, "Resonance Skill")],
      },
    ],
    damage: [],
  })
  char.buffs = [
    {
      id: "gold.convert",
      name: "Convert",
      trigger: {
        event: "skillCast",
        actor: "self",
        characterId: 1,
        skillCategory: "Resonance Skill",
      },
      effects: [{ kind: "convert", count }],
    },
  ]
  return char
}

describe("Emit Pool — explicit convert", () => {
  it("convert all matures every held core early, oldest and newest alike", () => {
    testCharacters = [convertChar("all")]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [
        tlEntry(1, stageOf("pool-a"), "e1"),
        tlEntry(1, stageOf("pool-a"), "e2"),
        tlEntry(1, RESONANCE_STAGE, "e3"),
      ],
      slots,
      loadouts,
    )
    const synths = log.filter(isPoolSynth)
    // Cores from e1 (frame 0) and e2 (frame 60) both convert on e3's cast at
    // frame 120 → land at 120 + 40 = 160, not at their natural 340 / 400.
    expect(synths.map((s) => s.frame)).toEqual([160, 160])
    expect(synths.some((s) => s.frame === 340 || s.frame === 400)).toBe(false)
  })

  it("convert N matures only the oldest N; the rest mature naturally", () => {
    testCharacters = [convertChar(1)]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [
        tlEntry(1, stageOf("pool-a"), "e1"),
        tlEntry(1, stageOf("pool-a"), "e2"),
        tlEntry(1, RESONANCE_STAGE, "e3"),
      ],
      slots,
      loadouts,
    )
    const synths = log.filter(isPoolSynth)
    // Oldest (e1's core) converts on e3's cast → 160. e2's core is untouched and
    // matures naturally at 60 + 300 → lands at 400.
    expect(synths.map((s) => s.frame)).toEqual([160, 400])
  })

  it("convert on an empty pool is a harmless no-op", () => {
    testCharacters = [convertChar("all")]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [tlEntry(1, RESONANCE_STAGE, "e1")],
      slots,
      loadouts,
    )
    expect(log.filter(isPoolSynth)).toHaveLength(0)
  })
})

describe("Emit Pool — cap + FIFO displacement", () => {
  it("a spawn over cap displaces the oldest, converting it early", () => {
    testCharacters = [poolChar(1, 1)]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [
        tlEntry(1, stageOf("pool-a"), "e1"),
        tlEntry(1, stageOf("pool-a"), "e2"),
      ],
      slots,
      loadouts,
    )
    const actions = log.filter((e): e is ActionEvent => e.kind === "action")
    // e2 acts at frame 60 with the cap (1) member still in flight.
    expect(actions[1].pool).toBe(1)

    const synths = log.filter(isPoolSynth)
    // e1's core (frame 0) is displaced by e2's spawn at frame 60: it converts now
    // and lands at 60 + 40 = 100, NOT at its natural 0 + 100 + 40 = 140.
    // e2's core survives, maturing at 60 + 100 → lands at 200.
    expect(synths.map((s) => s.frame)).toEqual([100, 200])
    expect(synths.some((s) => s.frame === 140)).toBe(false)
  })

  it("a multi-spawn over cap displaces multiple oldest at once", () => {
    testCharacters = [poolChar(5, 2)]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [tlEntry(1, stageOf("pool-a"), "e1")],
      slots,
      loadouts,
    )
    const synths = log.filter(isPoolSynth)
    // Frame 0 spawns 5 into a cap-2 pool: 3 oldest displace and land at 0 + 40;
    // the 2 survivors mature at 100 and land at 140.
    expect(synths).toHaveLength(5)
    expect(synths.filter((s) => s.frame === TRAVEL)).toHaveLength(3)
    expect(synths.filter((s) => s.frame === MATURATION + TRAVEL)).toHaveLength(
      2,
    )
  })
})
