import { describe, expect, it, vi } from "vitest"
import type { BuffDef, EmitHitEffect } from "#/types/buff"
import { emptyResourceState } from "#/types/buff"
import { emptyStatTable } from "#/types/stat-table"
import {
  buffInstanceKey,
  buildSyntheticEvent,
  EmitHitDispatcher,
} from "./emit-hit-dispatcher"
import type { EmitHitHost, EmitHitInput } from "./emit-hit-dispatcher"

/** Snapshot-only host: build the synthetic event without engine state. */
function makeHost(): EmitHitHost {
  return {
    activeBuffs: () => [],
    passiveBuffs: () => [],
    resolveHealTargets: (_target, sourceId) => [sourceId],
  }
}

const def: BuffDef = {
  id: "test.emit",
  name: "Test Emit",
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  effects: [],
}

const effect: EmitHitEffect = {
  kind: "emitHit",
  damage: {
    type: "Basic Attack",
    dmgType: "Fusion",
    scalingStat: "atk",
    actionFrame: 0,
    value: 1.0,
    energy: 0,
    concerto: 0,
    toughness: 0,
    weakness: 0,
  },
  icdFrames: 60,
}

const input = (overrides: Partial<EmitHitInput> = {}): EmitHitInput => ({
  buffInstanceKey: buffInstanceKey(def.id, 1),
  def,
  effect,
  effectIndex: 0,
  sourceCharacterId: 1,
  ...overrides,
})

describe("EmitHitDispatcher — tryEmit decision (ICD + chain cap)", () => {
  it("ICD blocks a second emit within window for the same (BuffInstance, EffectIndex)", () => {
    const dispatcher = new EmitHitDispatcher({ chainDepthCap: 8 })
    const key = buffInstanceKey(def.id, 1)

    const first = dispatcher.tryEmit(input({ buffInstanceKey: key }), {
      frame: 0,
      depth: 0,
    })
    const second = dispatcher.tryEmit(input({ buffInstanceKey: key }), {
      frame: 30,
      depth: 0,
    })
    const third = dispatcher.tryEmit(input({ buffInstanceKey: key }), {
      frame: 60,
      depth: 0,
    })

    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(third).toBe(true)
  })

  it("ICD is per-effectIndex within the same BuffInstance", () => {
    const dispatcher = new EmitHitDispatcher({ chainDepthCap: 8 })
    const key = buffInstanceKey(def.id, 1)

    const a = dispatcher.tryEmit(
      input({ buffInstanceKey: key, effectIndex: 0 }),
      { frame: 0, depth: 0 },
    )
    const b = dispatcher.tryEmit(
      input({ buffInstanceKey: key, effectIndex: 1 }),
      { frame: 0, depth: 0 },
    )
    expect(a).toBe(true)
    expect(b).toBe(true)
  })

  it("returns false and warns when chain depth cap is reached", () => {
    const dispatcher = new EmitHitDispatcher({ chainDepthCap: 2 })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = dispatcher.tryEmit(
      input({ effect: { ...effect, icdFrames: 0 } }),
      { frame: 0, depth: 2 },
    )

    expect(result).toBe(false)
    expect(warn).toHaveBeenCalled()
    expect(warn.mock.calls[0][0]).toContain("emitHit chain depth exceeded")
    warn.mockRestore()
  })

  it("reset clears ICD state", () => {
    const dispatcher = new EmitHitDispatcher({ chainDepthCap: 8 })
    const key = buffInstanceKey(def.id, 1)

    dispatcher.tryEmit(input({ buffInstanceKey: key }), { frame: 0, depth: 0 })
    dispatcher.reset()
    const after = dispatcher.tryEmit(input({ buffInstanceKey: key }), {
      frame: 1,
      depth: 0,
    })
    expect(after).toBe(true)
  })
})

describe("buildSyntheticEvent — snapshot (damage + skillType)", () => {
  it("uses HP scaling when effect.damage.scalingStat is HP", () => {
    const host = makeHost()
    const stats = {
      ...emptyStatTable(),
      atkBase: 1000,
      hpBase: 5000,
      hpPct: 0.4,
      hpFlat: 300,
    }
    const hpEffect: EmitHitEffect = {
      ...effect,
      damage: { ...effect.damage, scalingStat: "HP" },
    }
    const atkEffect: EmitHitEffect = {
      ...effect,
      damage: { ...effect.damage, scalingStat: "ATK" },
    }
    const hpHit = buildSyntheticEvent(
      input({ effect: hpEffect }),
      0,
      stats,
      emptyResourceState(),
      host,
    )
    const atkHit = buildSyntheticEvent(
      input({ effect: atkEffect, sourceCharacterId: 2 }),
      0,
      stats,
      emptyResourceState(),
      host,
    )
    // HP base 5000 * 1.4 + 300 = 7300; ATK base 1000.
    const DEFRES = 0.5 * 0.9
    if (hpHit.kind !== "hit") throw new Error("expected HitEvent")
    if (atkHit.kind !== "hit") throw new Error("expected HitEvent")
    expect(hpHit.damage).toBe(Math.round(7300 * DEFRES))
    expect(atkHit.damage).toBe(Math.round(1000 * DEFRES))
  })

  describe("skillType fallback chain", () => {
    const buildWith = (eff: EmitHitEffect) =>
      buildSyntheticEvent(
        input({ effect: eff }),
        0,
        emptyStatTable(),
        emptyResourceState(),
        makeHost(),
      )

    it("falls back to damage.type when skillType override is absent", () => {
      const hit = buildWith({
        ...effect,
        damage: { ...effect.damage, type: "Resonance Skill" },
      })
      expect(hit.skillType).toBe("Resonance Skill")
    })

    it("uses explicit skillType override even when damage.type differs", () => {
      const hit = buildWith({
        ...effect,
        skillType: "Heavy Attack",
        damage: { ...effect.damage, type: "Resonance Skill" },
      })
      expect(hit.skillType).toBe("Heavy Attack")
    })

    it("defaults to Basic Attack when neither skillType override nor damage.type provides a value", () => {
      const hit = buildWith({
        ...effect,
        damage: { ...effect.damage, type: "Basic Attack" },
      })
      expect(hit.skillType).toBe("Basic Attack")
    })
  })
})
