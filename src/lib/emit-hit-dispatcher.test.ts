import { describe, expect, it, vi } from "vitest"
import type { BuffDef, EmitHitEffect, ResourceState } from "#/types/buff"
import { emptyResourceState } from "#/types/buff"
import type { BuffEvent, HitEvent } from "#/types/simulation-log"
import { emptyStatTable } from "#/types/stat-table"
import {
  buffInstanceKey,
  EmitHitDispatcher,
  type EmitHitHost,
} from "./emit-hit-dispatcher"

function makeHost(): EmitHitHost & { resources: Map<number, ResourceState> } {
  const resources = new Map<number, ResourceState>()
  return {
    resources,
    resolveStats: () => emptyStatTable(),
    applyResourceDelta: (id, resource, delta) => {
      const state = resources.get(id) ?? emptyResourceState()
      state[resource] += delta
      resources.set(id, state)
    },
    getResource: (id) => {
      let state = resources.get(id)
      if (!state) {
        state = emptyResourceState()
        resources.set(id, state)
      }
      return state
    },
    activeBuffIds: () => [],
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
    type: "ATK",
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

describe("EmitHitDispatcher", () => {
  it("ICD blocks a second emit within window for the same (BuffInstance, EffectIndex)", () => {
    const dispatcher = new EmitHitDispatcher({ chainDepthCap: 8 })
    const host = makeHost()
    const out: BuffEvent[] = []
    const hits: HitEvent[] = []
    const key = buffInstanceKey(def.id, 1)

    const first = dispatcher.dispatch(
      {
        buffInstanceKey: key,
        def,
        effect,
        effectIndex: 0,
        sourceCharacterId: 1,
      },
      { frame: 0, depth: 0 },
      host,
      out,
      hits,
    )
    expect(first).not.toBeNull()

    const second = dispatcher.dispatch(
      {
        buffInstanceKey: key,
        def,
        effect,
        effectIndex: 0,
        sourceCharacterId: 1,
      },
      { frame: 30, depth: 0 },
      host,
      out,
      hits,
    )
    expect(second).toBeNull()

    const third = dispatcher.dispatch(
      {
        buffInstanceKey: key,
        def,
        effect,
        effectIndex: 0,
        sourceCharacterId: 1,
      },
      { frame: 60, depth: 0 },
      host,
      out,
      hits,
    )
    expect(third).not.toBeNull()
  })

  it("ICD is per-effectIndex within the same BuffInstance", () => {
    const dispatcher = new EmitHitDispatcher({ chainDepthCap: 8 })
    const host = makeHost()
    const key = buffInstanceKey(def.id, 1)

    const a = dispatcher.dispatch(
      {
        buffInstanceKey: key,
        def,
        effect,
        effectIndex: 0,
        sourceCharacterId: 1,
      },
      { frame: 0, depth: 0 },
      host,
      [],
      [],
    )
    const b = dispatcher.dispatch(
      {
        buffInstanceKey: key,
        def,
        effect,
        effectIndex: 1,
        sourceCharacterId: 1,
      },
      { frame: 0, depth: 0 },
      host,
      [],
      [],
    )
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
  })

  it("returns null and warns when chain depth cap is reached", () => {
    const dispatcher = new EmitHitDispatcher({ chainDepthCap: 2 })
    const host = makeHost()
    const key = buffInstanceKey(def.id, 1)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = dispatcher.dispatch(
      {
        buffInstanceKey: key,
        def,
        effect: { ...effect, icdFrames: 0 },
        effectIndex: 0,
        sourceCharacterId: 1,
      },
      { frame: 0, depth: 2 },
      host,
      [],
      [],
    )
    expect(result).toBeNull()
    expect(warn).toHaveBeenCalled()
    expect(warn.mock.calls[0][0]).toContain("emitHit chain depth exceeded")
    warn.mockRestore()
  })

  it("uses HP scaling when effect.damage.scalingStat is HP", () => {
    const dispatcher = new EmitHitDispatcher({ chainDepthCap: 8 })
    const host: EmitHitHost = {
      resolveStats: () => ({
        ...emptyStatTable(),
        atkBase: 1000,
        hpBase: 5000,
        hpPct: 0.4,
        hpFlat: 300,
      }),
      applyResourceDelta: () => {},
      getResource: () => emptyResourceState(),
      activeBuffIds: () => [],
    }
    const hpEffect: EmitHitEffect = {
      ...effect,
      damage: { ...effect.damage, scalingStat: "HP" },
    }
    const atkEffect: EmitHitEffect = {
      ...effect,
      damage: { ...effect.damage, scalingStat: "ATK" },
    }
    const hpHit = dispatcher.dispatch(
      {
        buffInstanceKey: buffInstanceKey(def.id, 1),
        def,
        effect: hpEffect,
        effectIndex: 0,
        sourceCharacterId: 1,
      },
      { frame: 0, depth: 0 },
      host,
      [],
      [],
    )
    const atkHit = dispatcher.dispatch(
      {
        buffInstanceKey: buffInstanceKey(def.id, 2),
        def,
        effect: atkEffect,
        effectIndex: 0,
        sourceCharacterId: 2,
      },
      { frame: 0, depth: 0 },
      host,
      [],
      [],
    )
    expect(hpHit).not.toBeNull()
    expect(atkHit).not.toBeNull()
    // HP base 5000 * 1.4 + 300 = 7300; ATK base 1000.
    const DEFRES = 0.5 * 0.9
    expect(hpHit!.damage).toBe(Math.round(7300 * DEFRES))
    expect(atkHit!.damage).toBe(Math.round(1000 * DEFRES))
  })

  it("reset clears ICD state", () => {
    const dispatcher = new EmitHitDispatcher({ chainDepthCap: 8 })
    const host = makeHost()
    const key = buffInstanceKey(def.id, 1)

    dispatcher.dispatch(
      {
        buffInstanceKey: key,
        def,
        effect,
        effectIndex: 0,
        sourceCharacterId: 1,
      },
      { frame: 0, depth: 0 },
      host,
      [],
      [],
    )
    dispatcher.reset()
    const after = dispatcher.dispatch(
      {
        buffInstanceKey: key,
        def,
        effect,
        effectIndex: 0,
        sourceCharacterId: 1,
      },
      { frame: 1, depth: 0 },
      host,
      [],
      [],
    )
    expect(after).not.toBeNull()
  })
})
