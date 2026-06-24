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
import { verina } from "./verina"
import { encore } from "./encore"

const VERINA = 1503
const ENCORE = 1203
const FPS = 60
const DURATION_TOLERANCE = 12

const STAGE = {
  b3: "char.verina.basic-attack.cultivation.stage-3::basic-attack",
  b4: "char.verina.basic-attack.cultivation.stage-4::basic-attack",
  b5: "char.verina.basic-attack.cultivation.stage-5::basic-attack",
  botany: "char.verina.resonance-skill.botany-experiment.cast::resonance-skill",
  lib: "char.verina.resonance-liberation.arboreal-flourish.cast::resonance-liberation",
  mid1: "char.verina.basic-attack.starflower-blooms.mid-air-attack-starflower-blooms-stage-1::basic-attack",
  mid2: "char.verina.basic-attack.starflower-blooms.mid-air-attack-starflower-blooms-stage-2::basic-attack",
  mid3: "char.verina.basic-attack.starflower-blooms.mid-air-attack-starflower-blooms-stage-3::basic-attack",
  outro: "char.verina.outro-skill.blossom.cast::outro-skill",
  encoreBasic: "char.encore.basic-attack.wooly-attack.stage-1::basic-attack",
  encoreBasic2: "char.encore.basic-attack.wooly-attack.stage-2::basic-attack",
} as const

const BUFF = {
  giftOfNature: "char.verina.gift-of-nature",
  blossomAmp: "char.verina.blossom-amp",
  mark: "char.verina.photosynthesis-mark",
  consume: "char.verina.starflower-consume",
  coord: "char.verina.mark-coord-reaction",
  s3: "char.verina.s3-choice-to-flourish",
  s4: "char.verina.s4-blossoming-embrace",
  s6Dmg: "char.verina.s6-joyous-harvest-dmg",
  s6Coord: "char.verina.s6-joyous-harvest-coord",
} as const

const CHAIN_BUFFS = [BUFF.s3, BUFF.s4, BUFF.s6Dmg, BUFF.s6Coord]

type Entry = readonly [id: string, characterId: number, stageId: string]

// 2 Forte: Basic 5 hit + Botany hit. Long opener needed for the b5 stack.
const ROTATION_S0: readonly Entry[] = [
  ["b3", VERINA, STAGE.b3],
  ["b4", VERINA, STAGE.b4],
  ["b5", VERINA, STAGE.b5],
  ["botany", VERINA, STAGE.botany],
  ["lib", VERINA, STAGE.lib],
  ["coord1", ENCORE, STAGE.encoreBasic],
  ["coord2", ENCORE, STAGE.encoreBasic2],
  ["mid1", VERINA, STAGE.mid1],
  ["mid2", VERINA, STAGE.mid2],
  ["mid3", VERINA, STAGE.mid3],
  ["outro", VERINA, STAGE.outro],
  ["postOutro", ENCORE, STAGE.encoreBasic],
]

// 2 Forte from Botany alone (base hit + S2 grant); S2 lets the meta drop the chain.
const ROTATION_S6: readonly Entry[] = [
  ["b3", VERINA, STAGE.b3],
  ["botany", VERINA, STAGE.botany],
  ["lib", VERINA, STAGE.lib],
  ["coord1", ENCORE, STAGE.encoreBasic],
  ["coord2", ENCORE, STAGE.encoreBasic2],
  ["mid1", VERINA, STAGE.mid1],
  ["mid2", VERINA, STAGE.mid2],
  ["mid3", VERINA, STAGE.mid3],
  ["outro", VERINA, STAGE.outro],
  ["postOutro", ENCORE, STAGE.encoreBasic],
]

const logCache = new Map<string, SimulationLogEntry[]>()

function runRotation(
  key: "s0" | "s6",
  sequence: number,
  rotation: readonly Entry[],
): SimulationLogEntry[] {
  const cached = logCache.get(key)
  if (cached) return cached

  const slots: Slots = [VERINA, ENCORE, null]
  const loadouts: SlotLoadout[] = [
    { ...loadoutFromTemplate(verina.template), sequence },
    { ...loadoutFromTemplate(encore.template), sequence: 0 },
    emptyLoadout(),
  ]
  const entries: TimelineEntry[] = rotation.map(
    ([id, characterId, stageId]) => ({
      id,
      characterId,
      stageId,
    }),
  )
  const log = runSimulation(entries, slots, loadouts, {
    startWithFullEnergy: true,
  })
  logCache.set(key, log)
  return log
}

const runS0 = () => runRotation("s0", 0, ROTATION_S0)
const runS6 = () => runRotation("s6", 6, ROTATION_S6)

const hits = (log: SimulationLogEntry[]): HitEvent[] =>
  log.filter((e): e is HitEvent => e.kind === "hit")

const sustains = (log: SimulationLogEntry[]): SustainEvent[] =>
  log.filter((e): e is SustainEvent => e.kind === "sustain")

const buffEvents = (log: SimulationLogEntry[], buffId: string): BuffEvent[] =>
  log
    .filter((e): e is BuffEvent => e.kind.startsWith("buff"))
    .filter((b) => b.buffId === buffId)
    .sort((a, b) => a.frame - b.frame)

/** Buff lifecycle spans: first-apply and last-trigger to expiry. */
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
    fromApply: applied && expired ? expired.frame - applied.frame : undefined,
    fromLastTrigger:
      lastTrigger && expired ? expired.frame - lastTrigger.frame : undefined,
  }
}

const activeOn = (hit: HitEvent, buffId: string): boolean =>
  hit.activeBuffs.some((b) => b.id === buffId)

/** Stage's own tap, not a buff-emitted hit sharing the entry id. */
const stageTap = (log: SimulationLogEntry[], entryId: string): HitEvent =>
  hits(log).find(
    (h) =>
      h.sourceEntryId === entryId &&
      h.characterId === VERINA &&
      !h.sourceBuffId,
  )!

const consumeEmits = (log: SimulationLogEntry[]): SustainEvent[] =>
  sustains(log).filter((s) => s.sourceBuffId === BUFF.consume)

describe("Verina — Forte consume (Starflower Blooms)", () => {
  it("S0: 2 banked Forte → the 3rd mid-air whiffs (only 2 consume heals)", () => {
    const log = runS0()
    expect(consumeEmits(log)).toHaveLength(2)
  })

  it("S6: S2 supplies the 2nd Forte off Botany alone → still 2 consume heals", () => {
    const log = runS6()
    expect(consumeEmits(log)).toHaveLength(2)
  })
})

describe("Verina — base-kit team buffs", () => {
  it("Gift of Nature grants team ATK from Liberation onward, ~20s", () => {
    const log = runS0()
    const preLib = stageTap(log, "botany")
    const postLib = stageTap(log, "mid1")
    expect(activeOn(preLib, BUFF.giftOfNature)).toBe(false)
    expect(activeOn(postLib, BUFF.giftOfNature)).toBe(true)
    // Global target reaches the teammate.
    const partnerHit = hits(log).find(
      (h) => h.sourceEntryId === "coord1" && h.characterId === ENCORE,
    )!
    expect(activeOn(partnerHit, BUFF.giftOfNature)).toBe(true)
    // Delta is GoN +0.20 plus the template's Rejuvenating Glow 5pc team ATK +0.15.
    expect(activeOn(postLib, "echo-set.rejuvenating-glow.5pc.team-atk")).toBe(
      true,
    )
    expect(
      postLib.statsSnapshot.atkPct - preLib.statsSnapshot.atkPct,
    ).toBeCloseTo(0.35)

    // Refreshes on each mid-air Starflower cast; measure from the last.
    const life = lifespan(log, BUFF.giftOfNature)
    expect(life.applied).toBeDefined()
    expect(
      Math.abs((life.fromLastTrigger ?? 0) - 20 * FPS),
    ).toBeLessThanOrEqual(DURATION_TOLERANCE)
  })

  it("Outro Blossom amplifies team DMG +15% on the swap-in partner", () => {
    const log = runS0()
    const preOutro = hits(log).find(
      (h) => h.sourceEntryId === "coord1" && h.characterId === ENCORE,
    )!
    const postOutro = hits(log).find(
      (h) => h.sourceEntryId === "postOutro" && h.characterId === ENCORE,
    )!
    expect(activeOn(postOutro, BUFF.blossomAmp)).toBe(true)
    expect(
      postOutro.statsSnapshot.allAmp - preOutro.statsSnapshot.allAmp,
    ).toBeCloseTo(0.15)
  })

  it("Photosynthesis Mark fires Verina's coordinated attack off teammate hits", () => {
    const log = runS0()
    const coords = hits(log).filter((h) => h.sourceBuffId === BUFF.coord)
    expect(coords.length).toBeGreaterThan(0)
    for (const c of coords) {
      expect(c.coord).toBe(true)
      expect(c.characterId).toBe(VERINA)
    }
    const markLife = lifespan(log, BUFF.mark)
    expect(Math.abs((markLife.fromApply ?? 0) - 12 * FPS)).toBeLessThanOrEqual(
      DURATION_TOLERANCE,
    )
  })
})

describe("Verina — Resonance Chain", () => {
  it("S0: no chain buffs apply", () => {
    const log = runS0()
    for (const id of CHAIN_BUFFS) expect(buffEvents(log, id)).toHaveLength(0)
  })

  it("S6: S3 healing +12%, S4 Spectro +15%, S6 DMG +20% all fold into a mid-air hit", () => {
    const s0Mid = stageTap(runS0(), "mid1")
    const s6Mid = stageTap(runS6(), "mid1")

    // Chain buffs are S6's alone; mid-air-hit deltas vs S0 isolate each one.
    expect(
      s6Mid.statsSnapshot.healingBonus - s0Mid.statsSnapshot.healingBonus,
    ).toBeCloseTo(0.12)
    expect(
      s6Mid.statsSnapshot.elementBonus.Spectro -
        s0Mid.statsSnapshot.elementBonus.Spectro,
    ).toBeCloseTo(0.15)
    expect(
      s6Mid.statsSnapshot.allDmgBonus - s0Mid.statsSnapshot.allDmgBonus,
    ).toBeCloseTo(0.2)

    // S4 is global; confirm it reaches the teammate.
    const partnerHit = hits(runS6()).find(
      (h) => h.sourceEntryId === "coord1" && h.characterId === ENCORE,
    )!
    expect(activeOn(partnerHit, BUFF.s4)).toBe(true)
  })

  it("S6 DMG +20% lands on Starflower Blooms hits and leaks onto no other hit", () => {
    const s6 = runS6()
    const s0 = runS0()

    for (const stage of ["mid1", "mid2", "mid3"] as const) {
      const delta =
        stageTap(s6, stage).statsSnapshot.allDmgBonus -
        stageTap(s0, stage).statsSnapshot.allDmgBonus
      expect(delta).toBeCloseTo(0.2)
    }

    // Botany is not a Starflower Blooms hit: no bonus.
    const botanyDelta =
      stageTap(s6, "botany").statsSnapshot.allDmgBonus -
      stageTap(s0, "botany").statsSnapshot.allDmgBonus
    expect(botanyDelta).toBeCloseTo(0)
  })

  it("S6: Joyous Harvest emits an extra coordinated attack on mid-air Starflower", () => {
    const log = runS6()
    const s6Coords = hits(log).filter((h) => h.sourceBuffId === BUFF.s6Coord)
    expect(s6Coords.length).toBeGreaterThan(0)
  })
})

// Engine-level residue: no observable proxy in the rotation log.
describe("Verina — engine-level invariants", () => {
  function makeEngine(sequence: number) {
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [VERINA, null, null],
      loadouts: [
        { ...emptyLoadout(), sequence },
        emptyLoadout(),
        emptyLoadout(),
      ],
    })
    return engine
  }

  // Forte + Concerto grant, no buff/emit: no e2e log proxy.
  it("S2 Botany hit 1 grants +1 Forte and +10 Concerto", () => {
    const engine = makeEngine(2)
    engine.onEvent({
      kind: "hitLanded",
      characterId: VERINA,
      skillCategory: "Resonance Skill",
      dmgType: "Damage",
      stageId: STAGE.botany,
      hitIndex: 1,
      frame: 0,
      energy: 0,
      concerto: 0,
    })
    expect(engine.getResource(VERINA).forte).toBe(1)
    expect(engine.getResource(VERINA).concerto).toBe(10)
  })

  // S1 Outro HoT deferred: empty-effects stub until the engine has a HoT primitive.
})
