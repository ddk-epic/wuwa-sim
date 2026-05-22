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

describe("ResourceLedger — forte cap", () => {
  it("clamps forte at cap boundary", () => {
    const r = new ResourceLedger()
    r.registerCap(1, "forte", 4)
    expect(r.applyDelta(1, "forte", 4)).toEqual({ before: 0, after: 4 })
    expect(r.getResource(1).forte).toBe(4)
  })

  it("over-grant is silently clamped to cap", () => {
    const r = new ResourceLedger()
    r.registerCap(1, "forte", 4)
    r.applyDelta(1, "forte", 3)
    expect(r.applyDelta(1, "forte", 3)).toEqual({ before: 3, after: 4 })
    expect(r.getResource(1).forte).toBe(4)
  })

  it("multiple over-grants never exceed cap", () => {
    const r = new ResourceLedger()
    r.registerCap(1, "forte", 4)
    r.applyDelta(1, "forte", 10)
    r.applyDelta(1, "forte", 10)
    expect(r.getResource(1).forte).toBe(4)
  })

  it("cap = 0 prevents any forte accumulation", () => {
    const r = new ResourceLedger()
    r.registerCap(1, "forte", 0)
    expect(r.applyDelta(1, "forte", 5)).toEqual({ before: 0, after: 0 })
    expect(r.getResource(1).forte).toBe(0)
  })

  it("no cap registered — forte is uncapped", () => {
    const r = new ResourceLedger()
    r.applyDelta(1, "forte", 100)
    expect(r.getResource(1).forte).toBe(100)
  })

  it("cap only affects forte; energy, concerto, resonance remain uncapped", () => {
    const r = new ResourceLedger()
    r.registerCap(1, "forte", 4)
    r.applyDelta(1, "energy", 200)
    r.applyDelta(1, "concerto", 200)
    r.applyDelta(1, "resonance", 200)
    expect(r.getResource(1).energy).toBe(200)
    expect(r.getResource(1).concerto).toBe(200)
    expect(r.getResource(1).resonance).toBe(200)
  })

  it("clear resets resource values but caps persist", () => {
    const r = new ResourceLedger()
    r.registerCap(1, "forte", 2)
    r.applyDelta(1, "forte", 2)
    r.clear()
    r.applyDelta(1, "forte", 10)
    expect(r.getResource(1).forte).toBe(2)
  })

  it("clearCaps removes cap enforcement", () => {
    const r = new ResourceLedger()
    r.registerCap(1, "forte", 2)
    r.clearCaps()
    r.applyDelta(1, "forte", 10)
    expect(r.getResource(1).forte).toBe(10)
  })
})
