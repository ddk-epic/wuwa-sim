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
import type { HitContext } from "#/types/buff"
import { runSimulation } from "#/lib/simulation"
import { BuffEngine } from "#/lib/engine/buff-engine"
import { onEventResolved } from "#/lib/engine/buff-engine.test-utils"
import { emptyLoadout, loadoutFromTemplate } from "#/lib/loadout/template"
import { getFocusedStageCatalog } from "#/components/skills/focused-stage-catalog"
import { validateTimeline } from "#/lib/timeline/validate-timeline"
import { camellya } from "./camellya"

const CAMELLYA = 1603
const FPS = 60
const DURATION_TOLERANCE = 18

const STAGE = {
  intro: "char.camellya.intro-skill.everblooming.cast::intro-skill",
  blossom:
    "char.camellya.resonance-skill.valse-of-bloom-and-blight.crimson-blossom::basic-attack",
  floral:
    "char.camellya.resonance-skill.valse-of-bloom-and-blight.floral-ravage::basic-attack",
  w1: "char.camellya.basic-attack.burgeoning.vining-waltz-1::basic-attack",
  w2: "char.camellya.basic-attack.burgeoning.vining-waltz-2::basic-attack",
  w3: "char.camellya.basic-attack.burgeoning.vining-waltz-3::basic-attack",
  w4: "char.camellya.basic-attack.burgeoning.vining-waltz-4::basic-attack",
  b1: "char.camellya.basic-attack.burgeoning.basic-attack-1::basic-attack",
  b2: "char.camellya.basic-attack.burgeoning.basic-attack-2::basic-attack",
  b3: "char.camellya.basic-attack.burgeoning.basic-attack-3::basic-attack",
  b4: "char.camellya.basic-attack.burgeoning.basic-attack-4::basic-attack",
  b5: "char.camellya.basic-attack.burgeoning.basic-attack-5::basic-attack",
  fervor:
    "char.camellya.resonance-liberation.fervor-efflorescent.cast::resonance-liberation",
  ephemeral:
    "char.camellya.resonance-skill.vegetative-universe.ephemeral::basic-attack",
  perennial:
    "char.camellya.resonance-skill.vegetative-universe.perennial::basic-attack",
  twining: "char.camellya.outro-skill.twining.cast::outro-skill",
} as const

const BUFF = {
  seedbed: "char.camellya.seedbed",
  epiphyte: "char.camellya.epiphyte",
  s1Crit: "char.camellya.s1-crit-dmg",
  s2Ephemeral: "char.camellya.s2-ephemeral-multiplier",
  s3Fervor: "char.camellya.s3-fervor-multiplier",
  s3BuddingAtk: "char.camellya.s3-budding-atk",
  s4Basic: "char.camellya.s4-intro-basic-bonus",
  s5Intro: "char.camellya.s5-intro-multiplier",
  s5Outro: "char.camellya.s5-outro-multiplier",
  s6SweetDream: "char.camellya.s6-sweet-dream-bonus",
  s6Perennial: "char.camellya.s6-sweet-dream-bonus-perennial",
  perennialEntry: "char.camellya.perennial-entry",
  bud: "char.camellya.crimson-bud",
  budding: "char.camellya.budding-mode",
  blossom: "char.camellya.blossom-mode",
  outroPrimed: "char.camellya.outro-primed",
  outroExtra: "char.camellya.outro-post-ephemeral",
} as const

const CHAIN_BUFFS = [
  BUFF.s1Crit,
  BUFF.s2Ephemeral,
  BUFF.s3Fervor,
  BUFF.s3BuddingAtk,
  BUFF.s4Basic,
  BUFF.s5Intro,
  BUFF.s5Outro,
  BUFF.s6SweetDream,
  BUFF.s6Perennial,
]

type Entry = readonly [id: string, stageId: string]

// Opener primed (concerto + energy). Crimson Blossom + Vining Waltz 1–4 drain a
// partial 6 buds; Ephemeral snapshots Sweet Dream and enters Budding Mode. The
// long interweave rebuilds concerto to 100 for Twining off raw hits alone —
// Budding suppresses the pistil→concerto conversion. Floral Ravage closes Blossom.
const ROTATION_S0: readonly Entry[] = [
  ["intro", STAGE.intro],
  ["blossom", STAGE.blossom],
  ["w1", STAGE.w1],
  ["w2", STAGE.w2],
  ["w3", STAGE.w3],
  ["w4", STAGE.w4],
  ["fervor", STAGE.fervor],
  ["ephemeral", STAGE.ephemeral],
  ["floral", STAGE.floral],
  ["i_b1", STAGE.b1],
  ["i_b2", STAGE.b2],
  ["i_b3", STAGE.b3],
  ["i_b4", STAGE.b4],
  ["i_b5", STAGE.b5],
  ["blossom2", STAGE.blossom],
  ["i2_b1", STAGE.b1],
  ["i2_b2", STAGE.b2],
  ["i2_b3", STAGE.b3],
  ["i2_b4", STAGE.b4],
  ["i2_b5", STAGE.b5],
  ["i3_b1", STAGE.b1],
  ["i3_b2", STAGE.b2],
  ["i3_b3", STAGE.b3],
  ["i3_b4", STAGE.b4],
  ["i3_b5", STAGE.b5],
  ["i4_b1", STAGE.b1],
  ["i4_b2", STAGE.b2],
  ["i4_b3", STAGE.b3],
  ["outro", STAGE.twining],
]

// S6 spine = S0 minus the outro, plus a Perennial second Budding entry after the
// concerto rebuild. Post-Perennial core hits read the +2.5 Sweet Dream rider.
const ROTATION_S6: readonly Entry[] = [
  ...ROTATION_S0.slice(0, -1),
  ["perennial", STAGE.perennial],
  ["p_b1", STAGE.b1],
  ["p_b2", STAGE.b2],
  ["p_b3", STAGE.b3],
]

const logCache = new Map<string, SimulationLogEntry[]>()

function runRotation(
  key: "s0" | "s6",
  sequence: number,
  rotation: readonly Entry[],
): SimulationLogEntry[] {
  const cached = logCache.get(key)
  if (cached) return cached

  const slots: Slots = [CAMELLYA, null, null]
  const loadouts: SlotLoadout[] = [
    { ...loadoutFromTemplate(camellya.template), sequence },
    emptyLoadout(),
    emptyLoadout(),
  ]
  const entries: TimelineEntry[] = rotation.map(([id, stageId]) => ({
    id,
    characterId: CAMELLYA,
    stageId,
  }))
  const log = runSimulation(entries, slots, loadouts, {
    startWithFullConcerto: true,
    startWithFullEnergy: true,
  })
  logCache.set(key, log)
  return log
}

const runS0 = () => runRotation("s0", 0, ROTATION_S0)
const runS6 = () => runRotation("s6", 6, ROTATION_S6)

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
  const expired = [...evs].reverse().find((b) => b.kind === "buffExpired")
  return {
    applied,
    expired,
    fromApply: applied && expired ? expired.frame - applied.frame : undefined,
  }
}

const peakStacks = (log: SimulationLogEntry[], buffId: string): number =>
  Math.max(0, ...buffEvents(log, buffId).map((b) => b.stacks))

const activeOn = (hit: HitEvent, buffId: string): boolean =>
  hit.activeBuffs.some((b) => b.id === buffId)

/** Stage's own tap, not a buff-emitted hit sharing the entry id. */
const stageTap = (log: SimulationLogEntry[], entryId: string): HitEvent =>
  hits(log).find(
    (h) =>
      h.sourceEntryId === entryId &&
      h.characterId === CAMELLYA &&
      !h.sourceBuffId,
  )!

const actionFor = (log: SimulationLogEntry[], entryId: string): ActionEvent =>
  actions(log).find((a) => a.sourceEntryId === entryId)!

/** Diagnostics the resource/cooldown net guards. Footing stays constraint-only. */
const resourceDiagnostics = (log: SimulationLogEntry[]) =>
  actions(log).flatMap((a) =>
    (a.diagnostics ?? []).filter((d) => d.kind !== "footingViolation"),
  )

describe("Camellya — resource & cooldown net (rotation is castable)", () => {
  it("S0 raises no resource or cooldown diagnostic across the rotation", () => {
    expect(resourceDiagnostics(runS0())).toEqual([])
  })

  it("S6 raises no resource or cooldown diagnostic across the rotation", () => {
    expect(resourceDiagnostics(runS6())).toEqual([])
  })
})

describe("Camellya — Seedbed / Epiphyte passives", () => {
  it("Seedbed retags Heavy Pruning hits as Basic Attack, category unchanged", () => {
    const burgeoning = camellya.skills.find((s) => s.name === "Burgeoning")
    const heavy = burgeoning?.stages.find((s) => s.category === "Heavy Attack")
    expect(heavy?.damage.length).toBeGreaterThan(0)
    for (const entry of heavy?.damage ?? [])
      expect(entry.type).toBe("Basic Attack")
  })
})

describe("Camellya — Crimson Buds & Sweet Dream snapshot (S0)", () => {
  it("mints a partial 6 buds (never maxed) over the air combo", () => {
    const n = peakStacks(runS0(), BUFF.bud)
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThan(10)
    expect(n).toBe(6)
  })

  it("Ephemeral snapshots Sweet Dream = 0.5 + 0.05×N on core attacks", () => {
    const log = runS0()
    const sweetDream = 0.5 + 0.05 * peakStacks(log, BUFF.bud)
    // Lands on the post-Ephemeral core hits (Floral Ravage + basics)…
    expect(stageTap(log, "floral").statsSnapshot.bonusMultiplier).toBeCloseTo(
      sweetDream,
    )
    expect(stageTap(log, "i_b1").statsSnapshot.bonusMultiplier).toBeCloseTo(
      sweetDream,
    )
    // …but not on the Ephemeral cast itself.
    expect(
      stageTap(log, "ephemeral").statsSnapshot.bonusMultiplier,
    ).toBeCloseTo(0)
  })

  it("Budding Mode is active only from the Ephemeral cast onward", () => {
    const log = runS0()
    expect(activeOn(stageTap(log, "w1"), BUFF.budding)).toBe(false)
    expect(activeOn(stageTap(log, "i_b1"), BUFF.budding)).toBe(true)
  })

  it("buds are consumed at the Ephemeral cast", () => {
    const consumed = buffEvents(runS0(), BUFF.bud).some(
      (b) => b.kind === "buffConsumed",
    )
    expect(consumed).toBe(true)
  })
})

describe("Camellya — Blossom Mode presence lifecycle (S0)", () => {
  it("set by Crimson Blossom, cleared by Floral Ravage, re-set by the next Blossom", () => {
    const log = runS0()
    expect(activeOn(stageTap(log, "w1"), BUFF.blossom)).toBe(true)
    // Floral Ravage is the canonical Blossom exit…
    expect(activeOn(stageTap(log, "i_b3"), BUFF.blossom)).toBe(false)
    // …and the interweave's second Crimson Blossom re-enters it.
    expect(activeOn(stageTap(log, "i2_b1"), BUFF.blossom)).toBe(true)
    const closed = buffEvents(log, BUFF.blossom).filter(
      (b) => b.kind === "buffConsumed" || b.kind === "buffExpired",
    )
    expect(closed.length).toBeGreaterThan(0)
  })
})

describe("Camellya — Energy Regen Multiplier split (S0)", () => {
  it("consuming attacks generate energy outside Budding, zero inside", () => {
    const log = runS0()
    // Outside Budding (air combo) the gauge climbs on consuming hits.
    expect(actionFor(log, "w4").cumulativeEnergy).toBeGreaterThan(
      actionFor(log, "blossom").cumulativeEnergy,
    )
    // Inside Budding the ERM is cancelled to 0 — flat across the bud-window taps.
    expect(actionFor(log, "i_b5").cumulativeEnergy).toBeCloseTo(
      actionFor(log, "i_b1").cumulativeEnergy,
    )
  })
})

describe("Camellya — Outro post-Ephemeral extra hit (S0)", () => {
  it("Twining after Ephemeral emits one 459.02% Outro hit", () => {
    const extra = hits(runS0()).filter(
      (h) => h.sourceBuffId === BUFF.outroExtra,
    )
    expect(extra).toHaveLength(1)
    expect(extra[0].skillType).toBe("Outro Skill")
    expect(extra[0].multiplier).toBeCloseTo(4.5902)
  })
})

describe("Camellya — Resonance Chain", () => {
  it("S0: no chain buffs apply", () => {
    const log = runS0()
    for (const id of CHAIN_BUFFS) expect(buffEvents(log, id)).toHaveLength(0)
  })

  it("S2: Ephemeral hit gains +120% DMG Multiplier (S6 vs S0)", () => {
    const delta =
      stageTap(runS6(), "ephemeral").statsSnapshot.bonusMultiplier -
      stageTap(runS0(), "ephemeral").statsSnapshot.bonusMultiplier
    expect(delta).toBeCloseTo(1.2)
  })

  it("S3: Fervor hit gains +50% DMG Multiplier (S6 vs S0)", () => {
    const delta =
      stageTap(runS6(), "fervor").statsSnapshot.bonusMultiplier -
      stageTap(runS0(), "fervor").statsSnapshot.bonusMultiplier
    expect(delta).toBeCloseTo(0.5)
  })

  it("S1: Intro grants +28% Crit DMG to later hits (S6 vs S0)", () => {
    const delta =
      stageTap(runS6(), "i_b1").statsSnapshot.critDmg -
      stageTap(runS0(), "i_b1").statsSnapshot.critDmg
    expect(delta).toBeCloseTo(0.28)
    const life = lifespan(runS6(), BUFF.s1Crit)
    expect(Math.abs((life.fromApply ?? 0) - 18 * FPS)).toBeLessThanOrEqual(
      DURATION_TOLERANCE,
    )
  })

  it("S4: Intro grants team +25% Basic Attack DMG (S6 vs S0)", () => {
    const delta =
      stageTap(runS6(), "i_b1").statsSnapshot.skillTypeBonus["Basic Attack"] -
      stageTap(runS0(), "i_b1").statsSnapshot.skillTypeBonus["Basic Attack"]
    expect(delta).toBeCloseTo(0.25)
  })

  it("S5: Intro hit gains +303% DMG Multiplier (S6 vs S0)", () => {
    const delta =
      stageTap(runS6(), "intro").statsSnapshot.bonusMultiplier -
      stageTap(runS0(), "intro").statsSnapshot.bonusMultiplier
    expect(delta).toBeCloseTo(3.03)
  })

  it("S3: Budding Mode grants +58% ATK (S6 vs S0)", () => {
    const delta =
      stageTap(runS6(), "i_b1").statsSnapshot.atkPct -
      stageTap(runS0(), "i_b1").statsSnapshot.atkPct
    expect(delta).toBeCloseTo(0.58)
  })

  it("S6: Sweet Dream gains the +1.5 rider (S6 vs S0)", () => {
    const delta =
      stageTap(runS6(), "i_b1").statsSnapshot.bonusMultiplier -
      stageTap(runS0(), "i_b1").statsSnapshot.bonusMultiplier
    expect(delta).toBeCloseTo(1.5)
  })
})

describe("Camellya — Perennial second Budding entry (S6)", () => {
  it("arms the perennial-entry marker on cast", () => {
    expect(activeOn(stageTap(runS6(), "p_b1"), BUFF.perennialEntry)).toBe(true)
  })

  it("Sweet Dream S6 portion is +2.5 via Perennial vs +1.5 via Ephemeral", () => {
    const log = runS6()
    // Perennial removes all buds, snapshot base 0.5 (N=0): 0.5 + 1.5 + 1.0.
    expect(stageTap(log, "p_b1").statsSnapshot.bonusMultiplier).toBeCloseTo(3.0)
    // Ephemeral entry carried 6 buds + the +1.5 rider: 0.5 + 0.3 + 1.5.
    expect(stageTap(log, "i_b1").statsSnapshot.bonusMultiplier).toBeCloseTo(2.3)
  })

  it("re-enters Budding Mode on the post-Perennial core hits", () => {
    expect(activeOn(stageTap(runS6(), "p_b1"), BUFF.budding)).toBe(true)
  })
})

// Mock-free engine pokes: branches and edge cases the solo rotation can't reach.
describe("Camellya — engine-level invariants", () => {
  const OUTRO_HIT: HitContext = {
    stageId: STAGE.twining,
    skill: "twining",
    hitIndex: 1,
    skillCategory: "Outro Skill",
    skillType: "Outro Skill",
    element: "Havoc",
  }

  function makeEngine(sequence = 0) {
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [CAMELLYA, null, null],
      loadouts: [
        { ...emptyLoadout(), sequence },
        emptyLoadout(),
        emptyLoadout(),
      ],
    })
    return engine
  }

  function refillForte(engine: BuffEngine, frame: number) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Intro Skill",
      dmgType: "Damage",
      stageId: STAGE.intro,
      frame,
      forte: 100,
    })
  }
  function consumeForte(
    engine: BuffEngine,
    forte: number,
    frame: number,
    concerto = 0,
  ) {
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      stageId: STAGE.b1,
      frame,
      concerto,
      forte,
    })
  }
  const budStacks = (engine: BuffEngine) =>
    engine.activeBuffs(CAMELLYA).find((b) => b.id === BUFF.bud)?.stacks ?? 0

  it("Seedbed +15% Havoc and Epiphyte +15% Basic fold at bootstrap", () => {
    const engine = new BuffEngine()
    // Drop the default elemDmg mains so Havoc reflects Seedbed alone.
    engine.bootstrap({
      slots: [CAMELLYA, null, null],
      loadouts: [
        { ...emptyLoadout(), cost3Mains: ["er", "er"] },
        emptyLoadout(),
        emptyLoadout(),
      ],
    })
    // Seedbed's Havoc isolates cleanly; Epiphyte's Basic rides atop the
    // Basic-priority skill tree, so only its lower bound is assertable here.
    expect(engine.resolveStats(CAMELLYA).elementBonus.Havoc).toBeCloseTo(0.15)
    expect(
      engine.resolveStats(CAMELLYA).skillTypeBonus["Basic Attack"],
    ).toBeGreaterThanOrEqual(0.15)
  })

  // Conversion is exercised but not load-bearing in the rotation (opener
  // overbanks, Budding suppresses it), so its exact arithmetic lives here.
  it("each 10 forte consumed recovers 4 Concerto alongside the bud", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    consumeForte(engine, -30, 1, 5)
    expect(engine.getResource(CAMELLYA).concerto).toBe(17)
    expect(budStacks(engine)).toBe(3)
  })

  it("Budding Mode suppresses the whole conversion — no bud, no Concerto", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      stageId: STAGE.ephemeral,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    refillForte(engine, 1)
    consumeForte(engine, -30, 2, 5)
    expect(engine.getResource(CAMELLYA).concerto).toBe(5)
    expect(budStacks(engine)).toBe(0)
  })

  it("Crimson Buds decay on independent 15s timers, oldest first", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    consumeForte(engine, -10, 10) // 1 bud, expires 910
    consumeForte(engine, -20, 300) // 2 buds, expire 1200
    expect(budStacks(engine)).toBe(3)
    engine.tickToFrame(950)
    expect(budStacks(engine)).toBe(2)
  })

  it("10 buds minted in one frame share an expiry and drop together", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    consumeForte(engine, -100, 5)
    expect(budStacks(engine)).toBe(10)
    engine.tickToFrame(904)
    expect(budStacks(engine)).toBe(10)
    engine.tickToFrame(905)
    expect(budStacks(engine)).toBe(0)
  })

  it("Budding Mode ends on swap-out", () => {
    const engine = makeEngine()
    refillForte(engine, 0)
    engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      stageId: STAGE.ephemeral,
      skillCategory: "Resonance Skill",
      frame: 1,
    })
    expect(engine.activeBuffIds(CAMELLYA)).toContain(BUFF.budding)
    engine.onEvent({ kind: "swapOut", characterId: CAMELLYA, frame: 2 })
    expect(engine.activeBuffIds(CAMELLYA)).not.toContain(BUFF.budding)
  })

  it("Ephemeral cast floors concerto at 0 and clamps forte to the cap", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "hitLanded",
      characterId: CAMELLYA,
      skillCategory: "Basic Attack",
      dmgType: "Damage",
      frame: 0,
      concerto: 50,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      skillCategory: "Resonance Skill",
      frame: 1,
      concerto: -70,
      forte: 100,
    })
    expect(engine.getResource(CAMELLYA).concerto).toBe(0)
    expect(engine.getResource(CAMELLYA).forte).toBe(100)
  })

  // S5 Outro +68% has no reachable e2e proxy: S0 has the outro but not S5,
  // S6 has S5 but drops the outro.
  it("S5: Outro hits gain +68% DMG Multiplier (sequence 5)", () => {
    const s0 = makeEngine(0)
    const s5 = makeEngine(5)
    const delta =
      s5.resolveStats(CAMELLYA, OUTRO_HIT).bonusMultiplier -
      s0.resolveStats(CAMELLYA, OUTRO_HIT).bonusMultiplier
    expect(delta).toBeCloseTo(0.68)
  })

  it("outro-primed produces no lifecycle log entries", () => {
    const engine = makeEngine()
    const arm = engine.onEvent({
      kind: "skillCast",
      characterId: CAMELLYA,
      stageId: STAGE.ephemeral,
      skillCategory: "Resonance Skill",
      frame: 0,
    })
    const fire = onEventResolved(engine, {
      kind: "skillCast",
      characterId: CAMELLYA,
      skillCategory: "Outro Skill",
      frame: 10,
    })
    const primed = [...arm.lifecycleEvents, ...fire.lifecycleEvents].filter(
      (e) => e.buffId === BUFF.outroPrimed,
    )
    expect(primed).toHaveLength(0)
  })

  it("Perennial is hidden below S6 and shown at S6", () => {
    const slots: [number, null, null] = [CAMELLYA, null, null]
    const below = getFocusedStageCatalog(
      slots,
      [{ ...emptyLoadout(), sequence: 5 }, emptyLoadout(), emptyLoadout()],
      CAMELLYA,
    )
    expect(
      below.characterStages.find((s) => s.label.includes("Perennial")),
    ).toBeUndefined()
    const at = getFocusedStageCatalog(
      slots,
      [{ ...emptyLoadout(), sequence: 6 }, emptyLoadout(), emptyLoadout()],
      CAMELLYA,
    )
    expect(
      at.characterStages.find((s) => s.label.includes("Perennial")),
    ).toBeDefined()
  })

  it("a Perennial entry is invalid below S6 and accepted at S6", () => {
    const slots: [number, null, null] = [CAMELLYA, null, null]
    const entry = { id: "p1", characterId: CAMELLYA, stageId: STAGE.perennial }
    const below = validateTimeline([entry], slots, [
      { ...emptyLoadout(), sequence: 5 },
      emptyLoadout(),
      emptyLoadout(),
    ])
    expect(below.invalidRowIds.has("p1")).toBe(true)
    const at = validateTimeline([entry], slots, [
      { ...emptyLoadout(), sequence: 6 },
      emptyLoadout(),
      emptyLoadout(),
    ])
    expect(at.invalidRowIds.has("p1")).toBe(false)
  })
})
