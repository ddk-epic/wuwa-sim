// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { HitEvent, SimulationLogEntry } from "#/types/simulation-log"
import { runSimulation } from "#/lib/simulation"
import { emptyLoadout, loadoutFromTemplate } from "#/lib/loadout/template"
import { shorekeeper } from "./shorekeeper"

/**
 * Shorekeeper's Collapsed Cores ride the Emit Pool: a Basic Attack combo spawns
 * cores (Stage 1 = 1, Stage 2 = 2, Stage 3 = 1, Stage 4 = 1 → 5 per combo) that
 * mature into Flare Star Butterflies 6s later, capped at 5 with FIFO displacement.
 */

const SHOREKEEPER = 1505
const MATURATION = 360

const STAGE = {
  ba1: "char.shorekeeper.basic-attack.origin-calculus.stage-1::basic-attack",
  ba2: "char.shorekeeper.basic-attack.origin-calculus.stage-2::basic-attack",
  ba3: "char.shorekeeper.basic-attack.origin-calculus.stage-3::basic-attack",
  ba4: "char.shorekeeper.basic-attack.origin-calculus.stage-4::basic-attack",
} as const

const COMBO = [STAGE.ba1, STAGE.ba2, STAGE.ba3, STAGE.ba4] as const

function runCombos(repeats: number): SimulationLogEntry[] {
  const slots: Slots = [SHOREKEEPER, null, null]
  const loadouts: SlotLoadout[] = [
    loadoutFromTemplate(shorekeeper.template),
    emptyLoadout(),
    emptyLoadout(),
  ]
  const entries: TimelineEntry[] = []
  for (let c = 0; c < repeats; c++) {
    for (let s = 0; s < COMBO.length; s++) {
      entries.push({
        id: `c${c}-s${s}`,
        characterId: SHOREKEEPER,
        stageId: COMBO[s],
      })
    }
  }
  return runSimulation(entries, slots, loadouts, { startWithFullEnergy: true })
}

const butterflies = (log: SimulationLogEntry[]): HitEvent[] =>
  log.filter(
    (e): e is HitEvent => e.kind === "hit" && e.sourceBuffId === "emitPool",
  )

describe("Shorekeeper — Flare Star Butterflies via Emit Pool", () => {
  it("a Basic Attack combo spawns 5 cores that mature into 5 butterflies", () => {
    const log = runCombos(1)
    const flies = butterflies(log)
    // S1(1) + S2(2) + S3(1) + S4(1) = 5 cores → 5 butterflies.
    expect(flies).toHaveLength(5)
    // The butterfly carries the payload moved out of the dead hidden stage.
    expect(flies.every((b) => b.multiplier === 0.3729)).toBe(true)
    expect(flies.every((b) => b.skillType === "Basic Attack")).toBe(true)
    // Each butterfly maturing late, none before its 6s maturation.
    expect(flies.every((b) => b.frame >= MATURATION)).toBe(true)
  })

  it("each butterfly feeds concerto via its payload", () => {
    const flies = butterflies(runCombos(1)).sort((a, b) => a.frame - b.frame)
    // Butterflies resolve after the combo, so they are the last concerto source;
    // the payload's concerto: 1 shows as a +1 step between consecutive butterflies.
    for (let i = 1; i < flies.length; i++) {
      expect(
        flies[i].cumulativeConcerto - flies[i - 1].cumulativeConcerto,
      ).toBe(1)
    }
  })

  it("at cap 5 a second combo displaces the oldest cores into early butterflies", () => {
    const log = runCombos(2)
    const flies = butterflies(log)
    // 10 cores spawned across two combos; each converts exactly once → 10 flies.
    expect(flies).toHaveLength(10)
    // Combo 1 fills the pool to cap 5; every combo-2 spawn displaces an oldest
    // core, converting it early (well before the 6s maturation). So 5 land early
    // and the 5 combo-2 survivors mature late.
    const early = flies.filter((b) => b.frame < MATURATION)
    expect(early).toHaveLength(5)
  })
})
