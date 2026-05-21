import { describe, expect, it } from "vitest"
import { ResourceLedger } from "./resource-ledger"

describe("ResourceLedger", () => {
  it("returns zeroed state for unseen characters", () => {
    const r = new ResourceLedger()
    expect(r.getResource(1)).toEqual({
      energy: 0,
      concerto: 0,
      forte: 0,
      resonance: 0,
    })
  })

  it("applyDelta returns before/after and mutates state", () => {
    const r = new ResourceLedger()
    expect(r.applyDelta(1, "energy", 30)).toEqual({ before: 0, after: 30 })
    expect(r.applyDelta(1, "energy", 20)).toEqual({ before: 30, after: 50 })
    expect(r.getResource(1).energy).toBe(50)
  })

  it("setValue overwrites and returns transition", () => {
    const r = new ResourceLedger()
    r.applyDelta(1, "concerto", 40)
    expect(r.setValue(1, "concerto", 0)).toEqual({ before: 40, after: 0 })
    expect(r.getResource(1).concerto).toBe(0)
  })

  it("clear resets all state", () => {
    const r = new ResourceLedger()
    r.applyDelta(1, "energy", 99)
    r.clear()
    expect(r.getResource(1).energy).toBe(0)
  })

  it("ensureState is idempotent and does not clobber existing state", () => {
    const r = new ResourceLedger()
    r.applyDelta(1, "energy", 25)
    r.ensureState(1)
    expect(r.getResource(1).energy).toBe(25)
  })
})
