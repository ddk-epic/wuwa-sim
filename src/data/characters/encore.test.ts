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
import { encore } from "./encore"

const ENCORE = 1203
const FPS = 60
const DURATION_TOLERANCE = 12

const STAGE = {
  intro: "char.encore.intro-skill.woolies-helpers.cast::intro-skill",
  flamingWoolies:
    "char.encore.resonance-skill.flaming-woolies.flaming-woolies::resonance-skill",
  energeticWelcome:
    "char.encore.resonance-skill.flaming-woolies.energetic-welcome::resonance-skill",
  lib: "char.encore.resonance-liberation.cosmos-rave.cast::resonance-liberation",
  frolicking1:
    "char.encore.basic-attack.cosmos-rave.cosmos-frolicking-stage-1::basic-attack",
  frolicking2:
    "char.encore.basic-attack.cosmos-rave.cosmos-frolicking-stage-2::basic-attack",
  frolicking3:
    "char.encore.basic-attack.cosmos-rave.cosmos-frolicking-stage-3::basic-attack",
  frolicking4: "char.encore.basic-attack.cosmos-rave.stage-4::basic-attack",
  rampage:
    "char.encore.resonance-skill.cosmos-rave.cosmos-rampage::resonance-skill",
  cosmosRupture:
    "char.encore.heavy-attack.black-white-woolies.cosmos-rupture::resonance-liberation",
  outro: "char.encore.outro-skill.thermal-field.cast::outro-skill",
} as const

const ROTATION: readonly string[] = [
  STAGE.intro,
  STAGE.flamingWoolies,
  STAGE.energeticWelcome,
  STAGE.lib,
  STAGE.frolicking1,
  STAGE.frolicking2,
  STAGE.frolicking3,
  STAGE.frolicking4,
  STAGE.rampage,
  STAGE.cosmosRupture,
  STAGE.outro,
]

const ENTRY = ROTATION.map((_, i) => `e${i}`)
const INTRO_ENTRY = ENTRY[0]
/** Rave-window entries: Frolicking 1-4, Rampage, Rupture. */
const RAVE_ENTRIES = new Set([
  ENTRY[4],
  ENTRY[5],
  ENTRY[6],
  ENTRY[7],
  ENTRY[8],
  ENTRY[9],
])

const BUFF = {
  cosmosRave: "char.encore.cosmos-rave",
  angryCosmos: "char.encore.angry-cosmos",
  cheerDance: "char.encore.woolies-cheer-dance",
  s1: "char.encore.s1-woolys-fairy-tale",
  s4: "char.encore.s4-adventure-lets-go",
  s6: "char.encore.s6-woolies-save-the-world",
} as const

const CHAIN_BUFFS = [BUFF.s1, BUFF.s4, BUFF.s6]

const logCache = new Map<number, SimulationLogEntry[]>()

// The rotation is fixed per sequence and the log is read-only, so simulate once.
function runRotation(sequence: number): SimulationLogEntry[] {
  const cached = logCache.get(sequence)
  if (cached) return cached

  const slots: Slots = [ENCORE, null, null]
  const loadouts: SlotLoadout[] = [
    { ...loadoutFromTemplate(encore.template), sequence },
    emptyLoadout(),
    emptyLoadout(),
  ]
  const entries: TimelineEntry[] = ROTATION.map((stageId, i) => ({
    id: ENTRY[i],
    characterId: ENCORE,
    stageId,
  }))
  const log = runSimulation(entries, slots, loadouts, {
    startWithFullEnergy: true,
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

/** Frames from a buff's first apply / last trigger to expiry. */
function lifespan(log: SimulationLogEntry[], buffId: string) {
  const evs = buffEvents(log, buffId)
  const applied = evs.find((b) => b.kind === "buffApplied")
  const expired = [...evs].reverse().find((b) => b.kind === "buffExpired")
  const lastTrigger = [...evs]
    .reverse()
    .find((b) => b.kind === "buffApplied" || b.kind === "buffRefreshed")
  return {
    applied,
    expired,
    lastTrigger,
    fromApply: applied && expired ? expired.frame - applied.frame : undefined,
    fromLastTrigger:
      lastTrigger && expired ? expired.frame - lastTrigger.frame : undefined,
  }
}

const peakStacks = (log: SimulationLogEntry[], buffId: string): number =>
  Math.max(0, ...buffEvents(log, buffId).map((b) => b.stacks))

const activeOn = (hit: HitEvent, buffId: string): boolean =>
  hit.activeBuffs.some((b) => b.id === buffId)

const stacksOn = (hit: HitEvent, buffId: string): number =>
  hit.activeBuffs.find((b) => b.id === buffId)?.stacks ?? 0

const fusion = (hit: HitEvent): number => hit.statsSnapshot.elementBonus.Fusion

describe("Encore — forte rotation, base-kit buffs", () => {
  it.each([0, 6])(
    "Cosmos Rave window buffs cover every in-Rave hit and last ~10s (S%i)",
    (sequence) => {
      const log = runRotation(sequence)
      const raveHits = hits(log).filter(
        (h) => h.sourceEntryId && RAVE_ENTRIES.has(h.sourceEntryId),
      )
      expect(raveHits.length).toBeGreaterThan(0)

      for (const id of [BUFF.cosmosRave, BUFF.angryCosmos]) {
        const life = lifespan(log, id)
        expect(life.applied).toBeDefined()
        expect(Math.abs((life.fromApply ?? 0) - 10 * FPS)).toBeLessThanOrEqual(
          DURATION_TOLERANCE,
        )
        for (const h of raveHits) expect(activeOn(h, id)).toBe(true)
      }

      // Only Angry Cosmos toggles allDmgBonus from pre-Rave to Rave; delta isolates +0.1.
      const introHit = hits(log).find((h) => h.sourceEntryId === INTRO_ENTRY)
      expect(introHit).toBeDefined()
      for (const h of raveHits)
        expect(
          h.statsSnapshot.allDmgBonus - introHit!.statsSnapshot.allDmgBonus,
        ).toBeCloseTo(0.1)
    },
  )

  it.each([0, 6])(
    "Woolies Cheer Dance applies on the first Resonance Skill, refreshes, and runs 10s past its last (S%i)",
    (sequence) => {
      const log = runRotation(sequence)
      const evs = buffEvents(log, BUFF.cheerDance)
      expect(evs[0]?.kind).toBe("buffApplied")
      expect(evs.some((b) => b.kind === "buffRefreshed")).toBe(true)

      const life = lifespan(log, BUFF.cheerDance)
      expect(
        Math.abs((life.fromLastTrigger ?? 0) - 10 * FPS),
      ).toBeLessThanOrEqual(DURATION_TOLERANCE)

      // Cheer lapses mid-outro, the only Fusion change there; present minus absent isolates +0.1.
      const outroHits = hits(log).filter((h) => h.sourceEntryId === ENTRY[10])
      const withCheer = outroHits.filter((h) => activeOn(h, BUFF.cheerDance))
      const withoutCheer = outroHits.filter(
        (h) => !activeOn(h, BUFF.cheerDance),
      )
      expect(withCheer.length).toBeGreaterThan(0)
      expect(withoutCheer.length).toBeGreaterThan(0)
      expect(fusion(withCheer[0]) - fusion(withoutCheer[0])).toBeCloseTo(0.1)
    },
  )
})

describe("Encore — forte rotation, Resonance Chain", () => {
  it("S0: no Resonance Chain buffs apply", () => {
    const log = runRotation(0)
    for (const id of CHAIN_BUFFS) expect(buffEvents(log, id)).toHaveLength(0)
  })

  it("S6: Wooly's Fairy Tale stacks to 4 on the Frolicking basics, adds +12% Fusion, lives 6s", () => {
    const log = runRotation(6)
    expect(peakStacks(log, BUFF.s1)).toBe(4)
    const life = lifespan(log, BUFF.s1)
    expect(life.applied).toBeDefined()
    expect(Math.abs((life.fromLastTrigger ?? 0) - 6 * FPS)).toBeLessThanOrEqual(
      DURATION_TOLERANCE,
    )

    // During Frolicking only S1 moves Fusion; 0→4 stack delta isolates 4×0.03.
    const preS1 = hits(log).find(
      (h) => h.sourceEntryId === ENTRY[4] && stacksOn(h, BUFF.s1) === 0,
    )
    const atMax = hits(log).find((h) => stacksOn(h, BUFF.s1) === 4)
    expect(preS1).toBeDefined()
    expect(atMax).toBeDefined()
    expect(fusion(atMax!) - fusion(preS1!)).toBeCloseTo(0.12)
  })

  it("S6: Cosmos Rupture grants the team Fusion buff for 30s", () => {
    const log = runRotation(6)
    const life = lifespan(log, BUFF.s4)
    expect(life.applied).toBeDefined()
    // S4 keys off Cosmos Rupture (Rave branch), not Cloudy Frenzy.
    const rupture = hits(log).filter((h) => h.sourceEntryId === ENTRY[9])
    expect(rupture.every((h) => activeOn(h, BUFF.s4))).toBe(true)
    expect(Math.abs((life.fromApply ?? 0) - 30 * FPS)).toBeLessThanOrEqual(
      DURATION_TOLERANCE,
    )

    // Only S4 changes Fusion from rampage to rupture; delta isolates +0.2.
    const lastRampage = hits(log)
      .filter((h) => h.sourceEntryId === ENTRY[8])
      .at(-1)
    expect(lastRampage).toBeDefined()
    expect(fusion(rupture[0]) - fusion(lastRampage!)).toBeCloseTo(0.2)
  })

  it("S6: Lost Lamb stacks to 5 (+25% ATK) and is minted only inside Rave", () => {
    const log = runRotation(6)
    expect(peakStacks(log, BUFF.s6)).toBe(5)

    // atkPct is S6's alone; 0→5 stack delta isolates 5×0.05.
    const preLamb = hits(log).find((h) => h.sourceEntryId === ENTRY[2])
    const atMax = hits(log).find((h) => stacksOn(h, BUFF.s6) === 5)
    expect(preLamb).toBeDefined()
    expect(atMax).toBeDefined()
    expect(
      atMax!.statsSnapshot.atkPct - preLamb!.statsSnapshot.atkPct,
    ).toBeCloseTo(0.25)

    // Stacks accrue only during Rave; first application lands inside the window.
    const rave = lifespan(log, BUFF.cosmosRave)
    const firstStack = lifespan(log, BUFF.s6).applied?.frame ?? -1
    expect(rave.applied?.frame ?? -1).toBeGreaterThan(0)
    expect(firstStack).toBeGreaterThanOrEqual(rave.applied?.frame ?? -1)
    expect(firstStack).toBeLessThanOrEqual(rave.expired?.frame ?? -1)

    // Each in-Rave grant lingers its full 10s, contributing past Rave's end (outro tail).
    const introHit = hits(log).find((h) => h.sourceEntryId === INTRO_ENTRY)
    expect(introHit && activeOn(introHit, BUFF.s6)).toBe(false)
    const ruptureHits = hits(log).filter((h) => h.sourceEntryId === ENTRY[9])
    expect(ruptureHits.length).toBeGreaterThan(0)
    expect(ruptureHits.every((h) => activeOn(h, BUFF.s6))).toBe(true)
    const outroHits = hits(log).filter((h) => h.sourceEntryId === ENTRY[10])
    expect(outroHits.length).toBeGreaterThan(0)
    expect(outroHits.every((h) => activeOn(h, BUFF.s6))).toBe(true)
  })
})
