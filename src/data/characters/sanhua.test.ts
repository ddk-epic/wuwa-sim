import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout } from "#/types/loadout"
import { BuffEngine } from "#/lib/engine/buff-engine"
import { onEventResolved } from "#/lib/engine/buff-engine.test-utils"
import { sanhua } from "./sanhua"

let testCharacters: EnrichedCharacter[] = []

vi.mock("../../lib/loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getWeaponById: () => null,
  getEchoById: () => null,
  getEchoSetById: () => null,
}))

afterEach(() => {
  testCharacters = []
})

const emptyLoadout: SlotLoadout = {
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

function makeEngine() {
  testCharacters = [sanhua]
  const engine = new BuffEngine()
  engine.bootstrap({
    slots: [1102, null, null],
    loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
  })
  return engine
}

describe("Sanhua — Avalanche (Forte Circuit Ice Burst +20%)", () => {
  it("applies Avalanche on Frigid Light Stage 5 cast; hit-agnostic stats unchanged", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Basic Attack",
      stageId: "char.sanhua.basic-attack.frigid-light.stage-5::basic-attack",
      frame: 0,
    })
    expect(engine.activeBuffIds(1102)).toContain(
      "char.sanhua.passive.avalanche",
    )
    // Avalanche is appliesToHits — hit-agnostic pass must not see it
    const stats = engine.resolveStats(1102)
    expect(stats.allDmgBonus).toBeCloseTo(0)
  })

  it("Ice Thorn burst statsSnapshot includes +0.2 allDmgBonus when Avalanche is active", () => {
    const engine = makeEngine()
    // Arm Avalanche (BA5) and Ice Thorn flag (Intro Skill)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Basic Attack",
      stageId: "char.sanhua.basic-attack.frigid-light.stage-5::basic-attack",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Intro Skill",
      frame: 1,
    })
    // Dispatch Detonate — produces deferred ice-thorn-burst emit at detonate+14
    const { deferredEmits } = onEventResolved(engine, {
      kind: "hitLanded",
      characterId: 1102,
      skillCategory: "Heavy Attack",
      stageId:
        "char.sanhua.heavy-attack.clarity-of-mind.detonate::heavy-attack",
      dmgType: "Damage",
      frame: 100,
    })
    const burstEmit = deferredEmits.find(
      (d) => d.input.def.id === "char.sanhua.ice-thorn-burst",
    )
    expect(burstEmit).toBeDefined()

    // Resolve the ice burst at its landing frame — stats must include Avalanche +0.2
    const resolved = engine.resolveDeferredEmit(burstEmit!)
    expect(resolved.event.kind).toBe("hit")
    const hit = resolved.event
    expect(hit.kind === "hit" && hit.statsSnapshot.allDmgBonus).toBeCloseTo(0.2)
  })

  it("Ice Thorn burst statsSnapshot has no allDmgBonus when Avalanche is absent", () => {
    const engine = makeEngine()
    // Arm Ice Thorn flag only — no BA5 cast, so Avalanche is NOT active
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Intro Skill",
      frame: 0,
    })
    const { deferredEmits } = onEventResolved(engine, {
      kind: "hitLanded",
      characterId: 1102,
      skillCategory: "Heavy Attack",
      stageId:
        "char.sanhua.heavy-attack.clarity-of-mind.detonate::heavy-attack",
      dmgType: "Damage",
      frame: 10,
    })
    const burstEmit = deferredEmits.find(
      (d) => d.input.def.id === "char.sanhua.ice-thorn-burst",
    )
    expect(burstEmit).toBeDefined()
    const resolved = engine.resolveDeferredEmit(burstEmit!)
    expect(resolved.event.kind).toBe("hit")
    const allDmgBonus =
      resolved.event.kind === "hit" && resolved.event.statsSnapshot.allDmgBonus
    expect(allDmgBonus).toBeCloseTo(0)
  })

  it("Ice Prism and Ice Glacier burst statsSnapshots each include +0.2 allDmgBonus when Avalanche is active", () => {
    const engine = makeEngine()
    // Arm Avalanche, Ice Prism flag (Resonance Skill), Ice Glacier flag (Resonance Liberation)
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Basic Attack",
      stageId: "char.sanhua.basic-attack.frigid-light.stage-5::basic-attack",
      frame: 0,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Resonance Skill",
      frame: 1,
    })
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Resonance Liberation",
      resonanceCost: 100,
      frame: 2,
    })

    // Detonate → deferred prism + glacier emits
    const { deferredEmits } = onEventResolved(engine, {
      kind: "hitLanded",
      characterId: 1102,
      skillCategory: "Heavy Attack",
      stageId:
        "char.sanhua.heavy-attack.clarity-of-mind.detonate::heavy-attack",
      dmgType: "Damage",
      frame: 100,
    })

    for (const id of [
      "char.sanhua.ice-prism-burst",
      "char.sanhua.ice-glacier-burst",
    ]) {
      const emit = deferredEmits.find((d) => d.input.def.id === id)
      expect(emit, `deferred emit for ${id}`).toBeDefined()
      const resolved = engine.resolveDeferredEmit(emit!)
      expect(resolved.event.kind, `${id} kind`).toBe("hit")
      const allDmgBonus =
        resolved.event.kind === "hit" &&
        resolved.event.statsSnapshot.allDmgBonus
      expect(allDmgBonus, `${id} allDmgBonus`).toBeCloseTo(0.2)
    }
  })

  it("resolveStats without hit context does not include Avalanche +0.2 even when active", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Basic Attack",
      stageId: "char.sanhua.basic-attack.frigid-light.stage-5::basic-attack",
      frame: 0,
    })
    expect(engine.activeBuffIds(1102)).toContain(
      "char.sanhua.passive.avalanche",
    )
    // Hit-agnostic pass must NOT fold the appliesToHits buff
    const stats = engine.resolveStats(1102)
    expect(stats.allDmgBonus).toBeCloseTo(0)
  })
})

describe("Sanhua — S5 Unraveling Fate (Ice Burst Crit DMG +100%)", () => {
  const DETONATE_STAGE =
    "char.sanhua.heavy-attack.clarity-of-mind.detonate::heavy-attack"

  function makeEngineSeq(sequence: number) {
    testCharacters = [sanhua]
    const engine = new BuffEngine()
    engine.bootstrap({
      slots: [1102, null, null],
      loadouts: [{ ...emptyLoadout, sequence }, emptyLoadout, emptyLoadout],
    })
    return engine
  }

  /** Arm the Ice Thorn flag (Intro Skill), detonate, and resolve the burst. */
  function resolveThornBurst(engine: ReturnType<typeof makeEngineSeq>) {
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Intro Skill",
      frame: 0,
    })
    const { deferredEmits } = onEventResolved(engine, {
      kind: "hitLanded",
      characterId: 1102,
      skillCategory: "Heavy Attack",
      stageId: DETONATE_STAGE,
      dmgType: "Damage",
      frame: 100,
    })
    const burst = deferredEmits.find(
      (d) => d.input.def.id === "char.sanhua.ice-thorn-burst",
    )
    expect(burst).toBeDefined()
    return engine.resolveDeferredEmit(burst!)
  }

  it("folds +100% Crit DMG into the Ice Burst snapshot at S5, even though the burst resolves 14 frames after the detonate", () => {
    const engine = makeEngineSeq(5)
    // Hit-agnostic baseline excludes the appliesToHits buff.
    const baseline = engine.resolveStats(1102).critDmg
    const resolved = resolveThornBurst(engine)
    expect(resolved.event.kind).toBe("hit")
    expect(
      resolved.event.kind === "hit" && resolved.event.statsSnapshot.critDmg,
    ).toBeCloseTo(baseline + 1.0)
  })

  it("does not boost the Ice Burst Crit DMG below S5", () => {
    const engine = makeEngineSeq(4)
    const baseline = engine.resolveStats(1102).critDmg
    const resolved = resolveThornBurst(engine)
    expect(
      resolved.event.kind === "hit" && resolved.event.statsSnapshot.critDmg,
    ).toBeCloseTo(baseline)
  })

  it("is excluded from the hit-agnostic stat pass at S5 (not pre-folded into base, never leaks onto the detonate Heavy tap)", () => {
    const engine = makeEngineSeq(5)
    expect(engine.activeBuffIds(1102)).toContain(
      "char.sanhua.s5.unraveling-fate",
    )
    const burstCritDmg = (
      resolveThornBurst(makeEngineSeq(5)).event as {
        statsSnapshot: { critDmg: number }
      }
    ).statsSnapshot.critDmg
    // Burst gets +1.0; the hit-agnostic pass must stay a full 1.0 below it.
    expect(engine.resolveStats(1102).critDmg).toBeCloseTo(burstCritDmg - 1.0)
  })
})

describe("Sanhua — Detonate burst honors its actionFrame offset (ADR-0028)", () => {
  const DETONATE_STAGE =
    "char.sanhua.heavy-attack.clarity-of-mind.detonate::heavy-attack"

  /** Arm the Ice Thorn flag (Intro Skill) then land the Detonate at `frame`. */
  function detonate(engine: ReturnType<typeof makeEngine>, frame: number) {
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Intro Skill",
      frame: 0,
    })
    return engine.onEvent({
      kind: "hitLanded",
      characterId: 1102,
      skillCategory: "Heavy Attack",
      stageId: DETONATE_STAGE,
      dmgType: "Damage",
      frame,
    })
  }

  it("burst defers to detonate + 14 and resolves there", () => {
    const engine = makeEngine()
    const dispatch = detonate(engine, 100)

    // The burst is surfaced as a deferred emit landing 14 frames later (its
    // `actionFrame` offset is honored unconditionally), never resolved inline.
    expect(dispatch.deferredEmits).toHaveLength(1)
    const deferred = dispatch.deferredEmits[0]
    expect(deferred.landingFrame).toBe(114)
    expect(deferred.input.def.id).toBe("char.sanhua.ice-thorn-burst")

    const resolved = engine.resolveDeferredEmit(deferred)
    expect(resolved.event.frame).toBe(114)
    expect(resolved.event.sourceBuffId).toBe("char.sanhua.ice-thorn-burst")
  })
})
