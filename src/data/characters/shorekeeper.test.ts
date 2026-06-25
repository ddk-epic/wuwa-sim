// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type {
  BuffEvent,
  HitEvent,
  SimulationLogEntry,
  SustainEvent,
} from "#/types/simulation-log"
import { runSimulation } from "#/lib/simulation"
import { BuffEngine } from "#/lib/engine/buff-engine"
import { emptyLoadout, loadoutFromTemplate } from "#/lib/loadout/template"
import { shorekeeper } from "./shorekeeper"
import { encore } from "./encore"
import { sanhua } from "./sanhua"

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
  illation: "char.shorekeeper.heavy-attack.astral-chord.illation::heavy-attack",
  chaos: "char.shorekeeper.resonance-skill.chaos-theory.cast::resonance-skill",
  lib: "char.shorekeeper.resonance-liberation.end-loop.cast::resonance-liberation",
  skOutro: "char.shorekeeper.outro-skill.binary-butterfly.cast::outro-skill",
  discern:
    "char.shorekeeper.intro-skill.proof-of-existence.discernment::resonance-liberation",
  encIntro: "char.encore.intro-skill.woolies-helpers.cast::intro-skill",
  encOutro: "char.encore.outro-skill.thermal-field.cast::outro-skill",
  sanIntro: "char.sanhua.intro-skill.freezing-thorns.cast::intro-skill",
  sanOutro: "char.sanhua.outro-skill.silversnow.cast::outro-skill",
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

const ENCORE = 1203
const SANHUA = 1102
const FPS = 60
const DURATION_TOLERANCE = 12

const BUFF = {
  outer: "char.shorekeeper.outer-stellarealm",
  inner: "char.shorekeeper.inner-stellarealm",
  supernal: "char.shorekeeper.supernal-stellarealm",
  selfGrav: "char.shorekeeper.self-gravitation",
  binaryButterfly: "char.shorekeeper.binary-butterfly",
  s2: "char.shorekeeper.s2-outer-stellarealm-atk",
  s3: "char.shorekeeper.s3-infinity-awaits-me",
  weaponHealAtk: "weapon.stellar-symphony.heal-atk",
} as const

type Entry = readonly [
  id: string,
  characterId: number,
  stageId: string,
  variantKind?: "cancel",
]

const ROTATION: readonly Entry[] = [
  ["b1", SHOREKEEPER, STAGE.ba1],
  ["b2", SHOREKEEPER, STAGE.ba2],
  ["b3", SHOREKEEPER, STAGE.ba3],
  ["b4", SHOREKEEPER, STAGE.ba4],
  ["illation", SHOREKEEPER, STAGE.illation, "cancel"],
  ["chaos", SHOREKEEPER, STAGE.chaos, "cancel"],
  ["lib", SHOREKEEPER, STAGE.lib],
  ["skOutro", SHOREKEEPER, STAGE.skOutro],
  ["sanIntro", SANHUA, STAGE.sanIntro],
  ["sanOutro", SANHUA, STAGE.sanOutro],
  ["encIntro", ENCORE, STAGE.encIntro],
  ["encOutro", ENCORE, STAGE.encOutro],
  ["discern", SHOREKEEPER, STAGE.discern],
]

const logCache = new Map<number, SimulationLogEntry[]>()

function runRotation(sequence: number): SimulationLogEntry[] {
  const cached = logCache.get(sequence)
  if (cached) return cached
  const slots: Slots = [SHOREKEEPER, ENCORE, SANHUA]
  const loadouts: SlotLoadout[] = [
    { ...loadoutFromTemplate(shorekeeper.template), sequence },
    { ...loadoutFromTemplate(encore.template), sequence: 0 },
    { ...loadoutFromTemplate(sanhua.template), sequence: 0 },
  ]
  const entries: TimelineEntry[] = ROTATION.map(
    ([id, characterId, stageId, variantKind]) => ({
      id,
      characterId,
      stageId,
      ...(variantKind ? { variantKind } : {}),
    }),
  )
  const log = runSimulation(entries, slots, loadouts, {
    startWithFullEnergy: true,
    startWithFullConcerto: true,
  })
  logCache.set(sequence, log)
  return log
}

const hits = (log: SimulationLogEntry[]): HitEvent[] =>
  log.filter((e): e is HitEvent => e.kind === "hit")

const buffEvents = (log: SimulationLogEntry[], buffId: string): BuffEvent[] =>
  log
    .filter((e): e is BuffEvent => e.kind.startsWith("buff"))
    .filter((b) => b.buffId === buffId)
    .sort((a, b) => a.frame - b.frame)

/** First-apply to expiry span for a non-refreshing buff. */
function lifespan(log: SimulationLogEntry[], buffId: string): number {
  const evs = buffEvents(log, buffId)
  const applied = evs.find((b) => b.kind === "buffApplied")!
  const expired = [...evs].reverse().find((b) => b.kind === "buffExpired")!
  return expired.frame - applied.frame
}

const activeOn = (hit: HitEvent, buffId: string): boolean =>
  hit.activeBuffs.some((b) => b.id === buffId)

const entryHit = (log: SimulationLogEntry[], entryId: string): HitEvent =>
  hits(log).find((h) => h.sourceEntryId === entryId)!

// Shorekeeper's opening Basic hit — before any cast, the pre-buff baseline.
const baseline = (log: SimulationLogEntry[]): HitEvent =>
  hits(log).find((h) => h.sourceEntryId === "b1" && !h.sourceBuffId)!

// A Flare Star Butterfly — a Shorekeeper Basic hit landing after the whole
// chain is up but before the first heal/teammate-outro, so its snapshot carries
// the team buffs cleanly (no Moonlit Clouds, no Rejuvenating Glow contamination).
const butterfly = (log: SimulationLogEntry[]): HitEvent => butterflies(log)[0]

const chaosHeal = (log: SimulationLogEntry[]): SustainEvent =>
  log.find(
    (e): e is SustainEvent =>
      e.kind === "sustain" && e.sub === "heal" && e.sourceEntryId === "chaos",
  )!

describe("Shorekeeper — full rotation, base-kit team buffs", () => {
  it("Illation converts the combo's 5 held cores into early butterflies", () => {
    const flies = butterflies(runRotation(0))
    expect(flies).toHaveLength(5)
    expect(flies.every((b) => b.frame < MATURATION)).toBe(true)
  })

  it("Chaos Theory casts a heal", () => {
    expect(chaosHeal(runRotation(0))).toBeDefined()
  })

  it.each([0, 6])(
    "Stellarealm evolves Inner→Supernal across intros, folding team Crit scaled by Energy Regen (S%i)",
    (sequence) => {
      const log = runRotation(sequence)
      const er = baseline(log).statsSnapshot.energyRechargePct

      // Inner Crit Rate on the butterflies (Inner up, Supernal not yet minted).
      expect(
        butterfly(log).statsSnapshot.critRate -
          baseline(log).statsSnapshot.critRate,
      ).toBeCloseTo(Math.min(((1 + er) / 0.002) * 0.0001, 0.125))

      // Supernal Crit DMG on the Chaos Theory hits (both realms up, no
      // Discernment crit pollution).
      const chaosDmg = hits(log).find(
        (h) => h.sourceEntryId === "chaos" && h.dmgType === "Damage",
      )!
      expect(activeOn(chaosDmg, BUFF.supernal)).toBe(true)
      expect(
        chaosDmg.statsSnapshot.critDmg - baseline(log).statsSnapshot.critDmg,
      ).toBeCloseTo(Math.min(((1 + er) / 0.001) * 0.0001, 0.25))

      // Evolution: the first Intro mints Inner only; the second adds Supernal.
      expect(activeOn(entryHit(log, "sanIntro"), BUFF.inner)).toBe(true)
      expect(activeOn(entryHit(log, "sanIntro"), BUFF.supernal)).toBe(false)
      expect(activeOn(entryHit(log, "encIntro"), BUFF.supernal)).toBe(true)
      const innerAt = buffEvents(log, BUFF.inner).find(
        (e) => e.kind === "buffApplied",
      )!.frame
      const supernalAt = buffEvents(log, BUFF.supernal).find(
        (e) => e.kind === "buffApplied",
      )!.frame
      expect(supernalAt).toBeGreaterThan(innerAt)
    },
  )

  it.each([0, 6])(
    "Self Gravitation folds +10% Energy Regen into Shorekeeper's hits (S%i)",
    (sequence) => {
      const log = runRotation(sequence)
      expect(
        butterfly(log).statsSnapshot.energyRechargePct -
          baseline(log).statsSnapshot.energyRechargePct,
      ).toBeCloseTo(0.1)
    },
  )

  it.each([0, 6])(
    "Binary Butterfly amplifies team DMG +15% for 30s (S%i)",
    (sequence) => {
      const log = runRotation(sequence)
      expect(
        butterfly(log).statsSnapshot.allAmp -
          baseline(log).statsSnapshot.allAmp,
      ).toBeCloseTo(0.15)
      expect(activeOn(entryHit(log, "sanIntro"), BUFF.binaryButterfly)).toBe(
        true,
      )
      expect(
        Math.abs(lifespan(log, BUFF.binaryButterfly) - 30 * FPS),
      ).toBeLessThanOrEqual(DURATION_TOLERANCE)
    },
  )

  it("Self Gravitation inherits Outer Stellarealm's 40s window at S1+", () => {
    // At S0 Discernment consumes it early (asserted below); the full window shows at S6.
    expect(
      Math.abs(lifespan(runRotation(6), BUFF.selfGrav) - 40 * FPS),
    ).toBeLessThanOrEqual(DURATION_TOLERANCE)
  })
})

describe("Shorekeeper — full rotation, Resonance Chain", () => {
  it("S0: requiresSequence buffs never apply", () => {
    const log = runRotation(0)
    expect(buffEvents(log, BUFF.s2)).toHaveLength(0)
    expect(
      butterfly(log).statsSnapshot.atkPct - baseline(log).statsSnapshot.atkPct,
    ).toBeCloseTo(0)
  })

  it("S2 grants team ATK +40% at S6", () => {
    const s6 = runRotation(6)
    expect(
      butterfly(s6).statsSnapshot.atkPct - baseline(s6).statsSnapshot.atkPct,
    ).toBeCloseTo(0.4)
    expect(activeOn(entryHit(s6, "sanIntro"), BUFF.s2)).toBe(true)
  })

  it("S4 folds Healing Bonus +70% into the Chaos Theory heal", () => {
    expect(
      chaosHeal(runRotation(6)).statsSnapshot.healingBonus -
        chaosHeal(runRotation(0)).statsSnapshot.healingBonus,
    ).toBeCloseTo(0.7)
  })

  it("S4 stays dormant below Sequence 4", () => {
    expect(chaosHeal(runRotation(3)).statsSnapshot.healingBonus).toBeCloseTo(
      chaosHeal(runRotation(0)).statsSnapshot.healingBonus,
    )
  })

  it("S6 gives Discernment Bonus Multiplier +42% and Crit DMG +500%; guaranteed crit applies at every sequence", () => {
    const log = runRotation(6)
    const discern = hits(log).filter((h) => h.sourceEntryId === "discern")
    const chaosDmg = hits(log).filter(
      (h) => h.sourceEntryId === "chaos" && h.dmgType === "Damage",
    )
    expect(discern.length).toBeGreaterThan(0)
    expect(chaosDmg.length).toBeGreaterThan(0)
    // Both carry the Stellarealm crit; the delta isolates the Discernment-only bonuses.
    const base = chaosDmg[0].statsSnapshot
    for (const h of discern) {
      expect(h.statsSnapshot.critRate).toBeCloseTo(base.critRate + 1)
      expect(h.statsSnapshot.bonusMultiplier).toBeCloseTo(
        base.bonusMultiplier + 0.42,
      )
      expect(h.statsSnapshot.critDmg).toBeCloseTo(base.critDmg + 5)
    }
    for (const h of chaosDmg) {
      expect(h.statsSnapshot.bonusMultiplier).toBeCloseTo(base.bonusMultiplier)
      expect(h.statsSnapshot.critDmg).toBeCloseTo(base.critDmg)
    }
  })
})

describe("Shorekeeper — Stellar Symphony heal-ATK through the rotation", () => {
  // Stellar Symphony buffs team ATK off a Resonance-Skill heal; Chaos Theory is
  // that heal. The buff lands after the heal, so the pre-heal butterflies miss it
  // while the cast's own damage and downstream teammates carry it.
  it("Chaos Theory's heal arms the team-ATK buff for wielder and allies", () => {
    const log = runRotation(0)
    const chaosDmg = hits(log).find(
      (h) => h.sourceEntryId === "chaos" && h.dmgType === "Damage",
    )!
    expect(activeOn(chaosDmg, BUFF.weaponHealAtk)).toBe(true)
    expect(activeOn(entryHit(log, "sanIntro"), BUFF.weaponHealAtk)).toBe(true)
    expect(activeOn(butterfly(log), BUFF.weaponHealAtk)).toBe(false)
  })
})

describe("Shorekeeper — Discernment consumes the Stellarealm at S0", () => {
  it("S0: casting Discernment removes Outer/Inner/Supernal/Self-Gravitation", () => {
    const log = runRotation(0)
    for (const id of [BUFF.outer, BUFF.inner, BUFF.supernal, BUFF.selfGrav])
      expect(buffEvents(log, id).some((e) => e.kind === "buffConsumed")).toBe(
        true,
      )
    // Binary Butterfly is not a Stellarealm; it survives to its own expiry.
    expect(
      buffEvents(log, BUFF.binaryButterfly).some(
        (e) => e.kind === "buffConsumed",
      ),
    ).toBe(false)
  })

  it("S6: Discernment leaves the Stellarealm intact", () => {
    const log = runRotation(6)
    for (const id of [BUFF.outer, BUFF.inner, BUFF.supernal])
      expect(buffEvents(log, id).some((e) => e.kind === "buffConsumed")).toBe(
        false,
      )
  })
})

// S3 is a cooldown-gated Concerto grant with no rotation log proxy (the gauge
// starts full, so the +20 overflows): asserted at the engine seam.
describe("Shorekeeper — S3 Concerto restore", () => {
  const makeEngine = (sequence: number) => {
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [SHOREKEEPER, null, null],
      loadouts: [
        { ...emptyLoadout(), sequence },
        emptyLoadout(),
        emptyLoadout(),
      ],
    })
    return engine
  }
  const libCast = (frame: number) =>
    ({
      kind: "skillCast",
      characterId: SHOREKEEPER,
      skillCategory: "Resonance Liberation",
      stageId: STAGE.lib,
      skill: "end-loop",
      frame,
      concerto: 0,
      resonanceCost: 175,
    }) as const

  it("S6: End Loop restores 20 Concerto, gated to once per 25s", () => {
    const engine = makeEngine(6)
    engine.onEvent(libCast(0))
    expect(engine.getResource(SHOREKEEPER).concerto).toBe(20)
    engine.onEvent(libCast(60))
    expect(engine.getResource(SHOREKEEPER).concerto).toBe(20)
    engine.onEvent(libCast(25 * FPS + 1))
    expect(engine.getResource(SHOREKEEPER).concerto).toBe(40)
  })

  it("S0: no Concerto restore", () => {
    const engine = makeEngine(0)
    engine.onEvent(libCast(0))
    expect(engine.getResource(SHOREKEEPER).concerto).toBe(0)
  })
})
