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

/** A pool character whose Basic Attack spawns `spawn` cores. */
const poolChar = (spawn: number): EnrichedCharacter => {
  const char = makeChar(1, "Pool A")
  char.emitPool = {
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
