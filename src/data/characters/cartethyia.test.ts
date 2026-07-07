// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type {
  ActionEvent,
  BuffEvent,
  HitEvent,
  SimulationLogEntry,
} from "#/types/simulation-log"
import { runSimulation } from "#/lib/simulation"
import { BuffEngine } from "#/lib/engine/buff-engine"
import { onEventResolved } from "#/lib/engine/buff-engine.test-utils"
import { emptyLoadout, loadoutFromTemplate } from "#/lib/loadout/template"
import { cartethyia } from "./cartethyia"

const CARTETHYIA = 1409
const ENCORE = 1203
const FPS = 60
const DURATION_TOLERANCE = 18

const STAGE = {
  lib: "char.cartethyia.resonance-liberation.a-knight-s-heartfelt-prayers.cast::resonance-liberation",
  t1: "char.cartethyia.basic-attack.tempest.basic-attack-stage-1::basic-attack",
  t2: "char.cartethyia.basic-attack.tempest.basic-attack-stage-2::basic-attack",
  t3: "char.cartethyia.basic-attack.tempest.basic-attack-stage-3::basic-attack",
  t4: "char.cartethyia.basic-attack.tempest.basic-attack-stage-4::basic-attack",
  t5: "char.cartethyia.basic-attack.tempest.basic-attack-stage-5::basic-attack",
  waves:
    "char.cartethyia.resonance-skill.tempest.sword-to-answer-waves-call::resonance-skill",
  tides:
    "char.cartethyia.resonance-skill.tempest.may-tempest-break-the-tides::resonance-skill",
  avatarCart:
    "char.cartethyia.resonance-liberation.a-knight-s-heartfelt-prayers.avatar-cartethyia::resonance-liberation",
  avatarFleur:
    "char.cartethyia.resonance-liberation.a-knight-s-heartfelt-prayers.avatar-fleurdelys::resonance-liberation",
  b2: "char.cartethyia.basic-attack.sword-to-carve-my-forms.stage-2::basic-attack",
  b3: "char.cartethyia.basic-attack.sword-to-carve-my-forms.stage-3::basic-attack",
  b4: "char.cartethyia.basic-attack.sword-to-carve-my-forms.stage-4::basic-attack",
  heavy:
    "char.cartethyia.basic-attack.sword-to-carve-my-forms.heavy-attack::basic-attack",
  plunge:
    "char.cartethyia.basic-attack.sword-to-carve-my-forms.mid-air-attack::basic-attack",
  rs: "char.cartethyia.resonance-skill.sword-to-bear-their-names.cast::basic-attack",
  blade:
    "char.cartethyia.resonance-liberation.a-knight-s-heartfelt-prayers.blade-of-howling-squall::resonance-liberation",
  outro: "char.cartethyia.outro-skill.wind-s-divine-blessing.cast::outro-skill",
  encoreIntro: "char.encore.intro-skill.woolies-helpers.cast::intro-skill",
} as const

const BUFF = {
  manifest: "char.cartethyia.manifest",
  fleurdelys: "char.cartethyia.fleurdelys-form",
  discord: "char.cartethyia.sword-of-discord",
  divinity: "char.cartethyia.sword-of-divinity",
  virtue: "char.cartethyia.sword-of-virtue",
  mandate: "char.cartethyia.mandate-of-divinity",
  powerOfDiscord: "char.cartethyia.power-of-discord",
  heartOfVirtue: "char.cartethyia.heart-of-virtue",
  divineBlessing: "char.cartethyia.divine-blessing",
  s4: "char.cartethyia.s4-sacrifice",
} as const

const RECALL_2 = "char.cartethyia.recall-2"
const RECALL_1 = "char.cartethyia.recall-1"
const EROSION_TICK = "negStatus.Aero Erosion"

type Entry = readonly [id: string, characterId: number, stageId: string]

// Solo Cartethyia opener burst into Fleurdelys, an Avatar excursion back to
// Cartethyia to mint shadows and plunge-recall them, then Blade closes Manifest
// and the Outro hands an Aero amp to Encore on swap-in.
const ROTATION: readonly Entry[] = [
  ["lib", CARTETHYIA, STAGE.lib],
  ["t1", CARTETHYIA, STAGE.t1],
  ["t2", CARTETHYIA, STAGE.t2],
  ["t3", CARTETHYIA, STAGE.t3],
  ["t4", CARTETHYIA, STAGE.t4],
  ["t5", CARTETHYIA, STAGE.t5],
  ["waves", CARTETHYIA, STAGE.waves],
  ["tides", CARTETHYIA, STAGE.tides],
  ["avatarCart", CARTETHYIA, STAGE.avatarCart],
  ["b2", CARTETHYIA, STAGE.b2],
  ["b3", CARTETHYIA, STAGE.b3],
  ["b4", CARTETHYIA, STAGE.b4],
  ["heavy", CARTETHYIA, STAGE.heavy],
  ["plunge1", CARTETHYIA, STAGE.plunge],
  ["rs", CARTETHYIA, STAGE.rs],
  ["plunge2", CARTETHYIA, STAGE.plunge],
  ["avatarFleur", CARTETHYIA, STAGE.avatarFleur],
  ["blade", CARTETHYIA, STAGE.blade],
  ["outro", CARTETHYIA, STAGE.outro],
  ["partnerIntro", ENCORE, STAGE.encoreIntro],
]

const logCache = new Map<number, SimulationLogEntry[]>()

function runRotation(sequence: number): SimulationLogEntry[] {
  const cached = logCache.get(sequence)
  if (cached) return cached
  const slots: Slots = [CARTETHYIA, ENCORE, null]
  const loadouts: SlotLoadout[] = [
    { ...loadoutFromTemplate(cartethyia.template), sequence },
    emptyLoadout(),
    emptyLoadout(),
  ]
  const entries: TimelineEntry[] = ROTATION.map(
    ([id, characterId, stageId]) => ({ id, characterId, stageId }),
  )
  const log = runSimulation(entries, slots, loadouts, {
    startWithFullConcerto: true,
    startWithFullEnergy: true,
  })
  logCache.set(sequence, log)
  return log
}

const runS0 = () => runRotation(0)
const runS6 = () => runRotation(6)

const actions = (log: SimulationLogEntry[]): ActionEvent[] =>
  log.filter((e): e is ActionEvent => e.kind === "action")

const hits = (log: SimulationLogEntry[]): HitEvent[] =>
  log.filter((e): e is HitEvent => e.kind === "hit")

const buffEvents = (log: SimulationLogEntry[], buffId: string): BuffEvent[] =>
  log
    .filter((e): e is BuffEvent => e.kind.startsWith("buff"))
    .filter((b) => b.buffId === buffId)
    .sort((a, b) => a.frame - b.frame)

function lifespan(log: SimulationLogEntry[], buffId: string) {
  const evs = buffEvents(log, buffId)
  const applied = evs.find((b) => b.kind === "buffApplied")
  const ended = [...evs]
    .reverse()
    .find((b) => b.kind === "buffExpired" || b.kind === "buffConsumed")
  return applied && ended ? ended.frame - applied.frame : undefined
}

const appliedFrame = (log: SimulationLogEntry[], buffId: string): number =>
  buffEvents(log, buffId).find((b) => b.kind === "buffApplied")!.frame

const clearedFrame = (log: SimulationLogEntry[], buffId: string): number =>
  buffEvents(log, buffId).find(
    (b) => b.kind === "buffConsumed" || b.kind === "buffExpired",
  )!.frame

/** Stage's own tap, not a buff-emitted hit sharing the entry id. */
const tap = (log: SimulationLogEntry[], entryId: string): HitEvent =>
  hits(log).find((h) => h.sourceEntryId === entryId && !h.sourceBuffId)!

/** Buff-emitted hits keyed to a plunge entry (the recall burst). */
const emitted = (
  log: SimulationLogEntry[],
  entryId: string,
  buffId: string,
): HitEvent[] =>
  hits(log).filter(
    (h) => h.sourceEntryId === entryId && h.sourceBuffId === buffId,
  )

const erosionTicks = (log: SimulationLogEntry[]): HitEvent[] =>
  hits(log).filter((h) => h.sourceBuffId === EROSION_TICK)

/** Resource and cooldown complaints; footing advisories are asserted apart. */
const resourceDiagnostics = (log: SimulationLogEntry[]): string[] =>
  actions(log)
    .filter((a) =>
      (a.diagnostics ?? []).some(
        (d) => d.kind === "skillOnCooldown" || d.kind === "insufficientEnergy",
      ),
    )
    .map((a) => a.sourceEntryId!)

describe("Cartethyia - rotation runs; only the unmodeled-Conviction stances complain", () => {
  // Avatar and Blade are Conviction-gated in game but modelled as Resonance
  // Liberation casts, so they read as on-cooldown and out of energy. The buff
  // pipeline still resolves; the rest of this file asserts the resulting state.
  it("confines resource and cooldown diagnostics to the liberation stances", () => {
    const expected = ["avatarCart", "avatarFleur", "blade"]
    expect([...new Set(resourceDiagnostics(runS0()))].sort()).toEqual(expected)
    expect([...new Set(resourceDiagnostics(runS6()))].sort()).toEqual(expected)
  })
})

describe("Cartethyia - Sword Shadows, plunge recall, and powers (S0)", () => {
  it("mints one shadow per source: Divinity, Discord, Virtue", () => {
    const log = runS0()
    expect(buffEvents(log, BUFF.divinity)[0].kind).toBe("buffApplied")
    expect(buffEvents(log, BUFF.discord)[0].kind).toBe("buffApplied")
    expect(buffEvents(log, BUFF.virtue)[0].kind).toBe("buffApplied")
  })

  it("first plunge recalls 2 shadows: three 3.3% hits, grants Mandate and Power of Discord", () => {
    const log = runS0()
    const recall = emitted(log, "plunge1", RECALL_2)
    expect(recall).toHaveLength(3)
    for (const h of recall) expect(h.multiplier).toBeCloseTo(0.033)
    expect(appliedFrame(log, BUFF.mandate)).toBeDefined()
    expect(appliedFrame(log, BUFF.powerOfDiscord)).toBeDefined()
    expect(clearedFrame(log, BUFF.divinity)).toBeDefined()
    expect(clearedFrame(log, BUFF.discord)).toBeDefined()
  })

  it("second plunge recalls the lone Virtue shadow: one 5.65% hit, grants Heart of Virtue", () => {
    const log = runS0()
    const recall = emitted(log, "plunge2", RECALL_1)
    expect(recall).toHaveLength(1)
    expect(recall[0].multiplier).toBeCloseTo(0.0565)
    expect(appliedFrame(log, BUFF.heartOfVirtue)).toBeDefined()
  })

  it("Blade ends Manifest and clears all three held powers", () => {
    const log = runS0()
    const bladeFrame = actions(log).find(
      (a) => a.sourceEntryId === "blade",
    )!.frame
    for (const power of [
      BUFF.mandate,
      BUFF.powerOfDiscord,
      BUFF.heartOfVirtue,
    ]) {
      expect(clearedFrame(log, power)).toBeLessThanOrEqual(bladeFrame)
    }
    expect(clearedFrame(log, BUFF.manifest)).toBeLessThanOrEqual(bladeFrame)
  })
})

describe("Cartethyia - Manifest window and form swaps (S0)", () => {
  it("Liberation enters Manifest and Fleurdelys form together", () => {
    const log = runS0()
    expect(appliedFrame(log, BUFF.manifest)).toBe(0)
    expect(appliedFrame(log, BUFF.fleurdelys)).toBe(0)
  })

  it("Avatar - Cartethyia drops Fleurdelys form; Avatar - Fleurdelys restores it", () => {
    const log = runS0()
    const events = buffEvents(log, BUFF.fleurdelys)
    // applied@lib, consumed@avatarCart, applied@avatarFleur, consumed@blade.
    const kinds = events.map((e) => e.kind)
    expect(kinds).toEqual([
      "buffApplied",
      "buffConsumed",
      "buffApplied",
      "buffConsumed",
    ])
    const avatarCartFrame = actions(log).find(
      (a) => a.sourceEntryId === "avatarCart",
    )!.frame
    expect(events[1].frame).toBeLessThanOrEqual(avatarCartFrame + 1)
  })

  it("Manifest survives the paused Cartethyia excursion and ends only at Blade", () => {
    const log = runS0()
    const manifestEnd = clearedFrame(log, BUFF.manifest)
    const plunge2 = actions(log).find(
      (a) => a.sourceEntryId === "plunge2",
    )!.frame
    // The whole shadow excursion happens with Manifest still up.
    expect(manifestEnd).toBeGreaterThan(plunge2)
  })
})

describe("Cartethyia - Aero Erosion drives Wind's Indelible Imprint vul (S0)", () => {
  it("no vul before erosion, flat 0.3 once the target is eroded", () => {
    const log = runS0()
    // Early Fleurdelys hits land before any erosion source.
    expect(tap(log, "t1").statsSnapshot.vul).toBeCloseTo(0)
    // Basic Stage 4 and the base Resonance Skill erode the target; the flat base
    // holds because 3 stacks sit at the per-stack threshold.
    expect(tap(log, "heavy").statsSnapshot.vul).toBeCloseTo(0.3)
    expect(tap(log, "blade").statsSnapshot.vul).toBeCloseTo(0.3)
  })
})

describe("Cartethyia - Mandate of Divinity amplifies Aero Erosion ticks (S0)", () => {
  it("erosion ticks gain +0.5 allAmp only while Mandate is held, and never double", () => {
    const log = runS0()
    const held = appliedFrame(log, BUFF.mandate)
    const dropped = clearedFrame(log, BUFF.mandate)
    const ticks = erosionTicks(log)
    const during = ticks.filter((t) => t.frame > held && t.frame < dropped)
    const outside = ticks.filter((t) => t.frame <= held || t.frame >= dropped)
    expect(during.length).toBeGreaterThan(0)
    for (const t of during) expect(t.statsSnapshot.allAmp).toBeCloseTo(0.5)
    for (const t of outside) expect(t.statsSnapshot.allAmp).toBeCloseTo(0)
    // No stacking: the amp tops out at a single application.
    expect(Math.max(...ticks.map((t) => t.statsSnapshot.allAmp))).toBeCloseTo(
      0.5,
    )
  })
})

describe("Cartethyia - Wind's Divine Blessing outro hands Aero amp to the swap-in", () => {
  it("Encore's intro hit carries +17.5% Aero elementAmp for 20s", () => {
    for (const log of [runS0(), runS6()]) {
      expect(
        tap(log, "partnerIntro").statsSnapshot.elementAmp.Aero,
      ).toBeCloseTo(0.175)
      expect(
        Math.abs((lifespan(log, BUFF.divineBlessing) ?? 0) - 20 * FPS),
      ).toBeLessThanOrEqual(DURATION_TOLERANCE)
    }
  })
})

describe("Cartethyia - Resonance Chain", () => {
  it("S0: no chain buffs apply", () => {
    const log = runS0()
    expect(buffEvents(log, BUFF.s4)).toHaveLength(0)
    expect(tap(log, "b4").statsSnapshot.bonusMultiplier).toBeCloseTo(0)
    expect(
      emitted(log, "plunge1", RECALL_2)[0].statsSnapshot.bonusMultiplier,
    ).toBeCloseTo(0)
    expect(tap(log, "blade").statsSnapshot.bonusMultiplier).toBeCloseTo(0)
    expect(tap(log, "t1").statsSnapshot.vul).toBeCloseTo(0)
    expect(tap(log, "b4").statsSnapshot.allDmgBonus).toBeCloseTo(0)
  })

  it("S2: Basic/Heavy hits gain +50% DMG Multiplier (S6 vs S0)", () => {
    const delta =
      tap(runS6(), "b4").statsSnapshot.bonusMultiplier -
      tap(runS0(), "b4").statsSnapshot.bonusMultiplier
    expect(delta).toBeCloseTo(0.5)
  })

  it("S2: plunge recall hits gain +200% DMG Multiplier (S6 vs S0)", () => {
    const delta =
      emitted(runS6(), "plunge1", RECALL_2)[0].statsSnapshot.bonusMultiplier -
      emitted(runS0(), "plunge1", RECALL_2)[0].statsSnapshot.bonusMultiplier
    expect(delta).toBeCloseTo(2)
  })

  it("S3: Blade gains +100% DMG Multiplier (S6 vs S0)", () => {
    const delta =
      tap(runS6(), "blade").statsSnapshot.bonusMultiplier -
      tap(runS0(), "blade").statsSnapshot.bonusMultiplier
    expect(delta).toBeCloseTo(1)
  })

  it("S4: eroding the target grants team +20% DMG (S6 vs S0)", () => {
    const delta =
      tap(runS6(), "b4").statsSnapshot.allDmgBonus -
      tap(runS0(), "b4").statsSnapshot.allDmgBonus
    expect(delta).toBeCloseTo(0.2)
  })

  it("S6: Manifest grants +40% vul, atop the erosion-driven +30% (S6 within-run)", () => {
    const log = runS6()
    // Early Fleurdelys hit: Manifest up, target not yet eroded.
    expect(tap(log, "t1").statsSnapshot.vul).toBeCloseTo(0.4)
    // Later Fleurdelys hit: erosion adds Indelible Imprint's +0.3 on top.
    expect(tap(log, "tides").statsSnapshot.vul).toBeCloseTo(0.7)
  })
})

// Mock-free engine pokes: branches and orderings the solo rotation can't reach.
describe("Cartethyia - engine-level invariants", () => {
  function makeEngine(sequence = 0) {
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [CARTETHYIA, null, null],
      loadouts: [
        { ...emptyLoadout(), sequence },
        emptyLoadout(),
        emptyLoadout(),
      ],
    })
    return engine
  }

  function erode(engine: BuffEngine, frame: number) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: CARTETHYIA,
      skillCategory: "Resonance Skill",
      dmgType: "Aero",
      stageId: STAGE.rs,
      hitIndex: 4,
      frame,
      energy: 0,
      concerto: 0,
    })
  }

  it("plunge with no shadows emits the single base plunge hit", () => {
    const engine = makeEngine()
    const { syntheticEvents } = onEventResolved(engine, {
      kind: "skillCast",
      characterId: CARTETHYIA,
      skillCategory: "Basic Attack",
      stageId: STAGE.plunge,
      frame: 0,
    })
    expect(syntheticEvents).toHaveLength(1)
    const hit = syntheticEvents[0]
    expect(hit.kind === "hit" && hit.multiplier).toBeCloseTo(0.0565)
  })

  it("Manifest is a 12s window that counts only Fleurdelys-form time", () => {
    const engine = makeEngine()
    onEventResolved(engine, {
      kind: "skillCast",
      characterId: CARTETHYIA,
      skillCategory: "Resonance Liberation",
      stageId: STAGE.lib,
      frame: 0,
    })
    expect(engine.activeBuffIds(CARTETHYIA)).toEqual(
      expect.arrayContaining([BUFF.manifest, BUFF.fleurdelys]),
    )

    // 300 frames of Fleurdelys time, then Avatar - Cartethyia pauses the window.
    engine.tickToFrame(300)
    onEventResolved(engine, {
      kind: "skillCast",
      characterId: CARTETHYIA,
      skillCategory: "Resonance Liberation",
      stageId: STAGE.avatarCart,
      frame: 300,
    })
    expect(engine.activeBuffIds(CARTETHYIA)).not.toContain(BUFF.fleurdelys)

    // Paused: the window outlasts an arbitrarily long base-form excursion.
    engine.tickToFrame(100000)
    expect(engine.activeBuffIds(CARTETHYIA)).toContain(BUFF.manifest)

    // Avatar - Fleurdelys resumes; 420 banked frames remain (720 - 300).
    onEventResolved(engine, {
      kind: "skillCast",
      characterId: CARTETHYIA,
      skillCategory: "Resonance Liberation",
      stageId: STAGE.avatarFleur,
      frame: 100000,
    })
    engine.tickToFrame(100419)
    expect(engine.activeBuffIds(CARTETHYIA)).toContain(BUFF.manifest)
    engine.tickToFrame(100420)
    expect(engine.activeBuffIds(CARTETHYIA)).not.toContain(BUFF.manifest)
  })

  // The rotation casts Liberation before eroding, so S2's cap raise no-ops there
  // (raiseCap only touches an existing status). Eroding first lets it land.
  it("S2 raises the Aero Erosion cap to 6, and vul scales past the flat base", () => {
    const engine = makeEngine(2)
    erode(engine, 0)
    expect(engine.getTarget().stacksOf("Aero Erosion")).toBe(2)
    expect(engine.getTarget().getInstance("Aero Erosion")!.cap).toBe(3)

    onEventResolved(engine, {
      kind: "skillCast",
      characterId: CARTETHYIA,
      skillCategory: "Resonance Liberation",
      stageId: STAGE.lib,
      frame: 1,
    })
    expect(engine.getTarget().getInstance("Aero Erosion")!.cap).toBe(6)

    erode(engine, 2)
    erode(engine, 3)
    expect(engine.getTarget().stacksOf("Aero Erosion")).toBe(6)
    // vul = 0.3 base + 0.1 per stack above the threshold of 3.
    expect(engine.resolveStats(CARTETHYIA).vul).toBeCloseTo(0.6)
  })
})
