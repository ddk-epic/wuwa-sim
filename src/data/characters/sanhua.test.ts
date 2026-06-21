// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type {
  BuffEvent,
  HitEvent,
  SimulationLogEntry,
} from "#/types/simulation-log"
import { runSimulation } from "#/lib/simulation"
import { emptyLoadout, loadoutFromTemplate } from "#/lib/loadout/template"
import { sanhua } from "./sanhua"
import { encore } from "./encore"

const SANHUA = 1102
const ENCORE = 1203
const FPS = 60
const DURATION_TOLERANCE = 12

const STAGE = {
  intro: "char.sanhua.intro-skill.freezing-thorns.cast::intro-skill",
  ba1: "char.sanhua.basic-attack.frigid-light.stage-1::basic-attack",
  ba2: "char.sanhua.basic-attack.frigid-light.stage-2::basic-attack",
  ba3: "char.sanhua.basic-attack.frigid-light.stage-3::basic-attack",
  ba4: "char.sanhua.basic-attack.frigid-light.stage-4::basic-attack",
  ba5: "char.sanhua.basic-attack.frigid-light.stage-5::basic-attack",
  rSkill: "char.sanhua.resonance-skill.eternal-frost.cast::resonance-skill",
  rLib: "char.sanhua.resonance-liberation.glacial-gaze.cast::resonance-liberation",
  detonate: "char.sanhua.heavy-attack.clarity-of-mind.detonate::heavy-attack",
  outro: "char.sanhua.outro-skill.silversnow.cast::outro-skill",
  partnerIntro: "char.encore.intro-skill.woolies-helpers.cast::intro-skill",
  partnerBasic: "char.encore.basic-attack.wooly-attack.stage-1::basic-attack",
} as const

type Step = {
  id: string
  characterId: number
  stageId: string
  variantKind?: "cancel"
}

/**
 * Arm all three Ice creations (Thorn ← Intro, Prism ← RSkill, Glacier ← RLib),
 * then one Detonate fires all three bursts. Basics precede skill/lib so the 5s
 * Prism/Glacier windows survive to the detonate; BA5 and skill are cancelled to
 * shorten the tail. Encore's Intro fires on swap-in.
 */
const STEPS: readonly Step[] = [
  { id: "intro", characterId: SANHUA, stageId: STAGE.intro },
  { id: "ba1", characterId: SANHUA, stageId: STAGE.ba1 },
  { id: "ba2", characterId: SANHUA, stageId: STAGE.ba2 },
  { id: "ba3", characterId: SANHUA, stageId: STAGE.ba3 },
  { id: "ba4", characterId: SANHUA, stageId: STAGE.ba4 },
  { id: "ba5", characterId: SANHUA, stageId: STAGE.ba5, variantKind: "cancel" },
  {
    id: "rskill",
    characterId: SANHUA,
    stageId: STAGE.rSkill,
    variantKind: "cancel",
  },
  { id: "rlib", characterId: SANHUA, stageId: STAGE.rLib },
  { id: "detonate", characterId: SANHUA, stageId: STAGE.detonate },
  { id: "outro", characterId: SANHUA, stageId: STAGE.outro },
  { id: "partnerIntro", characterId: ENCORE, stageId: STAGE.partnerIntro },
  { id: "partnerBasic", characterId: ENCORE, stageId: STAGE.partnerBasic },
]

const BUFF = {
  condensation: "char.sanhua.condensation",
  avalanche: "char.sanhua.avalanche",
  silversnow: "char.sanhua.silversnow",
  s1: "char.sanhua.s1",
  s4HeavyDmg: "char.sanhua.s4-heavy-dmg",
  s6: "char.sanhua.s6",
} as const

const BURSTS = [
  "char.sanhua.ice-thorn-burst",
  "char.sanhua.ice-prism-burst",
  "char.sanhua.ice-glacier-burst",
] as const

const logCache = new Map<number, SimulationLogEntry[]>()

// The rotation is fixed per sequence and the log is read-only, so simulate once.
function runRotation(sequence: number): SimulationLogEntry[] {
  const cached = logCache.get(sequence)
  if (cached) return cached

  const slots: Slots = [SANHUA, ENCORE, null]
  const loadouts: SlotLoadout[] = [
    { ...loadoutFromTemplate(sanhua.template), sequence },
    { ...loadoutFromTemplate(encore.template), sequence: 0 },
    emptyLoadout(),
  ]
  const entries: TimelineEntry[] = STEPS.map((s) => ({
    id: s.id,
    characterId: s.characterId,
    stageId: s.stageId,
    ...(s.variantKind ? { variantKind: s.variantKind } : {}),
  }))
  const log = runSimulation(entries, slots, loadouts, {
    startWithFullEnergy: true,
  })
  logCache.set(sequence, log)
  return log
}

const hits = (log: SimulationLogEntry[]): HitEvent[] =>
  log.filter((e): e is HitEvent => e.kind === "hit")

const hitsFrom = (log: SimulationLogEntry[], entryId: string): HitEvent[] =>
  hits(log).filter((h) => h.sourceEntryId === entryId)

/** Ice Burst emits; the detonate taps carry no `sourceBuffId`. */
const burstHits = (log: SimulationLogEntry[]): HitEvent[] =>
  hits(log).filter(
    (h) => h.sourceBuffId !== undefined && h.sourceBuffId.endsWith("-burst"),
  )

/** Detonate Heavy taps; bursts share the entry but carry a `sourceBuffId`. */
const detonateTaps = (log: SimulationLogEntry[]): HitEvent[] =>
  hitsFrom(log, "detonate").filter((h) => h.sourceBuffId === undefined)

const buffEvents = (log: SimulationLogEntry[], buffId: string): BuffEvent[] =>
  log
    .filter((e): e is BuffEvent => e.kind.startsWith("buff"))
    .filter((b) => b.buffId === buffId)
    .sort((a, b) => a.frame - b.frame)

/** Frames from a buff's last trigger to expiry (covers refresh). */
function lifespan(log: SimulationLogEntry[], buffId: string) {
  const evs = buffEvents(log, buffId)
  const expired = [...evs].reverse().find((b) => b.kind === "buffExpired")
  const lastTrigger = [...evs]
    .reverse()
    .find((b) => b.kind === "buffApplied" || b.kind === "buffRefreshed")
  return {
    applied: evs.find((b) => b.kind === "buffApplied"),
    expired,
    fromLastTrigger:
      lastTrigger && expired ? expired.frame - lastTrigger.frame : undefined,
  }
}

const peakStacks = (log: SimulationLogEntry[], buffId: string): number =>
  Math.max(0, ...buffEvents(log, buffId).map((b) => b.stacks))

const activeOn = (hit: HitEvent, buffId: string): boolean =>
  hit.activeBuffs.some((b) => b.id === buffId)

const near = (actual: number, expectedSeconds: number): void =>
  expect(Math.abs(actual - expectedSeconds * FPS)).toBeLessThanOrEqual(
    DURATION_TOLERANCE,
  )

describe("Sanhua — base-kit rotation", () => {
  it.each([0, 6])(
    "detonate fires all three Ice Bursts, each deferred past the detonate taps (S%i)",
    (sequence) => {
      const log = runRotation(sequence)
      const bursts = burstHits(log)
      expect(new Set(bursts.map((b) => b.sourceBuffId))).toEqual(
        new Set(BURSTS),
      )

      const lastTap = Math.max(...detonateTaps(log).map((h) => h.frame))
      for (const b of bursts) expect(b.frame).toBeGreaterThan(lastTap)
    },
  )

  it.each([0, 6])(
    "Avalanche adds +0.2 to every Ice Burst and never leaks onto the detonate taps (S%i)",
    (sequence) => {
      const log = runRotation(sequence)
      const taps = detonateTaps(log)
      expect(taps.length).toBeGreaterThan(0)
      const tapBonus = taps[0].statsSnapshot.allDmgBonus

      for (const tap of taps)
        expect(tap.statsSnapshot.allDmgBonus).toBeCloseTo(tapBonus)
      for (const b of burstHits(log))
        expect(b.statsSnapshot.allDmgBonus).toBeCloseTo(tapBonus + 0.2)

      near(lifespan(log, BUFF.avalanche).fromLastTrigger ?? 0, 8)
    },
  )

  it.each([0, 6])(
    "Condensation covers the Resonance Skill hit and lasts ~8s (S%i)",
    (sequence) => {
      const log = runRotation(sequence)
      const rSkillHits = hitsFrom(log, "rskill")
      expect(rSkillHits.length).toBeGreaterThan(0)
      for (const h of rSkillHits) {
        expect(activeOn(h, BUFF.condensation)).toBe(true)
        // Only Condensation grants a Resonance Skill bonus here.
        expect(h.statsSnapshot.skillTypeBonus["Resonance Skill"]).toBeCloseTo(
          0.2,
        )
      }
      near(lifespan(log, BUFF.condensation).fromLastTrigger ?? 0, 8)
    },
  )

  it.each([0, 6])(
    "Silversnow amps the swap-in partner's Basic Attack +38%, not Sanhua's own Basics (S%i)",
    (sequence) => {
      const log = runRotation(sequence)
      // Silversnow's amp only applies to basic attacks.
      const partnerBasic = hitsFrom(log, "partnerBasic")
      expect(partnerBasic.length).toBeGreaterThan(0)
      for (const h of partnerBasic) {
        expect(h.skillType).toBe("Basic Attack")
        expect(activeOn(h, BUFF.silversnow)).toBe(true)
        expect(h.statsSnapshot.skillTypeAmp["Basic Attack"]).toBeCloseTo(0.38)
      }

      // Silversnow targets the next on-field, not Sanhua.
      const sanhuaBasics = hits(log).filter(
        (h) => h.characterId === SANHUA && h.skillType === "Basic Attack",
      )
      expect(sanhuaBasics.length).toBeGreaterThan(0)
      for (const h of sanhuaBasics)
        expect(h.statsSnapshot.skillTypeAmp["Basic Attack"]).toBeCloseTo(0)

      near(lifespan(log, BUFF.silversnow).fromLastTrigger ?? 0, 14)
    },
  )
})

describe("Sanhua — Resonance Chain", () => {
  it("S0: no Resonance Chain buff applies", () => {
    const log = runRotation(0)
    expect(buffEvents(log, BUFF.s1)).toHaveLength(0)
    expect(buffEvents(log, BUFF.s6)).toHaveLength(0)
    // Without S5, bursts match the taps' Crit DMG.
    const tapCritDmg = detonateTaps(log)[0].statsSnapshot.critDmg
    for (const b of burstHits(log))
      expect(b.statsSnapshot.critDmg).toBeCloseTo(tapCritDmg)
  })

  it("S6: Solitude's Embrace adds +15% Crit Rate from BA5 onward and lasts ~10s", () => {
    const log = runRotation(6)
    expect(lifespan(log, BUFF.s1).applied).toBeDefined()

    // BA5 arms S1; delta off an earlier basic isolates +0.15.
    const ba1 = hitsFrom(log, "ba1")[0]
    const ba5 = hitsFrom(log, "ba5")[0]
    expect(ba5.statsSnapshot.critRate - ba1.statsSnapshot.critRate).toBeCloseTo(
      0.15,
    )

    near(lifespan(log, BUFF.s1).fromLastTrigger ?? 0, 10)
  })

  it("S6: Unraveling Fate folds +100% Crit DMG into every Ice Burst", () => {
    const log = runRotation(6)
    const tapCritDmg = detonateTaps(log)[0].statsSnapshot.critDmg
    for (const b of burstHits(log))
      expect(b.statsSnapshot.critDmg).toBeCloseTo(tapCritDmg + 1.0)
  })

  it("S6: Blade Mastery folds +120% Heavy DMG into the detonate taps, not the bursts", () => {
    const s0 = runRotation(0)
    const s6 = runRotation(6)

    const tapHeavyBonus = (log: SimulationLogEntry[]) =>
      detonateTaps(log)[0].statsSnapshot.skillTypeBonus["Heavy Attack"] ?? 0

    // Only S4 differs between runs; the tap delta isolates +1.2.
    expect(tapHeavyBonus(s6)).toBeCloseTo(tapHeavyBonus(s0) + 1.2)
    for (const tap of detonateTaps(s6))
      expect(activeOn(tap, BUFF.s4HeavyDmg)).toBe(true)

    // Bursts are Resonance Skill DMG; the detonate-scoped buff skips them.
    for (const b of burstHits(s6))
      expect(b.statsSnapshot.skillTypeBonus["Heavy Attack"] ?? 0).toBeCloseTo(
        tapHeavyBonus(s0),
      )

    near(lifespan(s6, BUFF.s4HeavyDmg).fromLastTrigger ?? 0, 5)
  })

  it("S6: Daybreak Radiance stacks team ATK to 2 (+20%) off the Prism + Glacier bursts, lasts ~20s", () => {
    const log = runRotation(6)
    expect(peakStacks(log, BUFF.s6)).toBe(2)
    near(lifespan(log, BUFF.s6).fromLastTrigger ?? 0, 20)

    // No post-detonate Sanhua hit; isolate +0.2 on the partner's basic, S6 vs S0.
    const partnerAtkPct = (seq: number) =>
      hitsFrom(runRotation(seq), "partnerBasic")[0].statsSnapshot.atkPct
    expect(partnerAtkPct(6) - partnerAtkPct(0)).toBeCloseTo(0.2)
  })
})
