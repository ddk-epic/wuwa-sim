// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type {
  HitEvent,
  SimulationLogEntry,
  SustainEvent,
} from "#/types/simulation-log"
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

const HIT_STAGE = {
  chaosTheory:
    "char.shorekeeper.resonance-skill.chaos-theory.cast::resonance-skill",
  discernment:
    "char.shorekeeper.intro-skill.proof-of-existence.discernment::resonance-liberation",
} as const

function runHitScopedRotation(sequence: number): SimulationLogEntry[] {
  const slots: Slots = [SHOREKEEPER, null, null]
  const loadouts: SlotLoadout[] = [
    { ...loadoutFromTemplate(shorekeeper.template), sequence },
    emptyLoadout(),
    emptyLoadout(),
  ]
  const entries: TimelineEntry[] = [
    { id: "chaos", characterId: SHOREKEEPER, stageId: HIT_STAGE.chaosTheory },
    { id: "discern", characterId: SHOREKEEPER, stageId: HIT_STAGE.discernment },
  ]
  return runSimulation(entries, slots, loadouts, { startWithFullEnergy: true })
}

const allHits = (log: SimulationLogEntry[]): HitEvent[] =>
  log.filter((e): e is HitEvent => e.kind === "hit")

const chaosTheoryHeal = (log: SimulationLogEntry[]): SustainEvent | undefined =>
  log.find(
    (e): e is SustainEvent =>
      e.kind === "sustain" && e.sub === "heal" && e.sourceEntryId === "chaos",
  )

describe("Shorekeeper — hit-scoped buffs via appliesToHits", () => {
  it("Chaos Theory heal is hit #1 of the cast stage", () => {
    const chaosTheory = shorekeeper.skills.find(
      (s) => s.name === "Chaos Theory",
    )
    const cast = chaosTheory?.stages.find((s) => s.name === "Skill DMG")
    expect(cast?.damage[0].dmgType).toBe("Heal")
    // The standalone hidden healing stage is gone.
    expect(chaosTheory?.stages.some((s) => s.name === "Healing")).toBe(false)
  })

  it("S4 folds Healing Bonus +70% into the Chaos Theory heal and nowhere else", () => {
    const log = runHitScopedRotation(6)
    const heal = chaosTheoryHeal(log)
    const base = chaosTheoryHeal(runHitScopedRotation(0))
    expect(heal).toBeDefined()
    expect(base).toBeDefined()
    expect(heal!.statsSnapshot.healingBonus).toBeCloseTo(
      base!.statsSnapshot.healingBonus + 0.7,
    )

    // The bonus reaches no other stage's hits.
    for (const h of allHits(log).filter((h) => h.sourceEntryId === "discern"))
      expect(h.statsSnapshot.healingBonus).toBeCloseTo(
        base!.statsSnapshot.healingBonus,
      )
  })

  it("S4 stays dormant below Sequence 4", () => {
    const seq3 = chaosTheoryHeal(runHitScopedRotation(3))
    const seq0 = chaosTheoryHeal(runHitScopedRotation(0))
    expect(seq3!.statsSnapshot.healingBonus).toBeCloseTo(
      seq0!.statsSnapshot.healingBonus,
    )
  })

  it("discernment hits gain Crit Rate, Bonus Multiplier, and Crit DMG; Chaos Theory DMG hits do not", () => {
    const hits = allHits(runHitScopedRotation(6))
    const discernment = hits.filter((h) => h.sourceEntryId === "discern")
    const chaosDmg = hits.filter(
      (h) => h.sourceEntryId === "chaos" && h.dmgType === "Damage",
    )
    expect(discernment.length).toBeGreaterThan(0)
    expect(chaosDmg.length).toBeGreaterThan(0)

    const base = chaosDmg[0].statsSnapshot
    for (const h of discernment) {
      expect(h.statsSnapshot.critRate).toBeCloseTo(base.critRate + 1)
      expect(h.statsSnapshot.bonusMultiplier).toBeCloseTo(
        base.bonusMultiplier + 0.42,
      )
      expect(h.statsSnapshot.critDmg).toBeCloseTo(base.critDmg + 5)
    }
    // The discernment bonuses never leak onto the Chaos Theory DMG hits.
    for (const h of chaosDmg) {
      expect(h.statsSnapshot.bonusMultiplier).toBeCloseTo(base.bonusMultiplier)
      expect(h.statsSnapshot.critDmg).toBeCloseTo(base.critDmg)
    }
  })
})
