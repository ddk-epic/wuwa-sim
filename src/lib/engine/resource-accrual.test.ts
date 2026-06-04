import { describe, expect, it } from "vitest"
import { accrueForHit } from "./resource-accrual"

const actor = { id: 1, er: 0.2, fr: 0.3 }
const party = [1, 2, 3]

describe("accrueForHit — pure resource gain rule (#321)", () => {
  it("scales actor energy by (1 + ER)", () => {
    const [first] = accrueForHit({ energy: 10 }, actor, party)
    expect(first).toEqual({
      characterId: 1,
      resource: "energy",
      delta: 10 * (1 + 0.2),
    })
  })

  it("shares teammate energy as energy * 0.5 * (1 + actorER), once, not double-scaled", () => {
    const accruals = accrueForHit({ energy: 10 }, actor, party)
    const shares = accruals.filter(
      (a) => a.resource === "energy" && a.characterId !== actor.id,
    )
    expect(shares).toEqual([
      { characterId: 2, resource: "energy", delta: 10 * 0.5 * (1 + 0.2) },
      { characterId: 3, resource: "energy", delta: 10 * 0.5 * (1 + 0.2) },
    ])
  })

  it("produces no teammate share for synthetic gains", () => {
    const accruals = accrueForHit({ energy: 10, synthetic: true }, actor, party)
    expect(accruals).toEqual([
      { characterId: 1, resource: "energy", delta: 10 * (1 + 0.2) },
    ])
  })

  it("grants concerto raw (no recharge scaling)", () => {
    const accruals = accrueForHit({ concerto: 7 }, actor, party)
    expect(accruals).toEqual([
      { characterId: 1, resource: "concerto", delta: 7 },
    ])
  })

  it("scales forte by (1 + FR)", () => {
    const accruals = accrueForHit({ forte: 4 }, actor, party)
    expect(accruals).toEqual([
      { characterId: 1, resource: "forte", delta: 4 * (1 + 0.3) },
    ])
  })

  it("applies negative forte (consumption) raw — FR scales gains only (ADR-0032)", () => {
    const accruals = accrueForHit({ forte: -9.3 }, actor, party)
    expect(accruals).toEqual([
      { characterId: 1, resource: "forte", delta: -9.3 },
    ])
  })

  it("emits deltas in order: actor energy, teammate energy, concerto, forte", () => {
    const accruals = accrueForHit(
      { energy: 10, concerto: 7, forte: 4 },
      actor,
      party,
    )
    expect(accruals).toEqual([
      { characterId: 1, resource: "energy", delta: 10 * (1 + 0.2) },
      { characterId: 2, resource: "energy", delta: 10 * 0.5 * (1 + 0.2) },
      { characterId: 3, resource: "energy", delta: 10 * 0.5 * (1 + 0.2) },
      { characterId: 1, resource: "concerto", delta: 7 },
      { characterId: 1, resource: "forte", delta: 4 * (1 + 0.3) },
    ])
  })

  it("scales actor energy by (1 + ER) × (1 + energyGainMult) (ADR-0033)", () => {
    const [first] = accrueForHit({ energy: 10 }, actor, party, 1.5)
    expect(first).toEqual({
      characterId: 1,
      resource: "energy",
      delta: 10 * (1 + 0.2) * (1 + 1.5),
    })
  })

  it("energyGainMult of −1.0 zeroes the actor's energy gain", () => {
    const [first] = accrueForHit({ energy: 10 }, actor, party, -1.0)
    expect(first.delta).toBeCloseTo(0)
  })

  it("energyGainMult leaves the teammate share unscaled", () => {
    const accruals = accrueForHit({ energy: 10 }, actor, party, 1.5)
    const shares = accruals.filter(
      (a) => a.resource === "energy" && a.characterId !== actor.id,
    )
    expect(shares).toEqual([
      { characterId: 2, resource: "energy", delta: 10 * 0.5 * (1 + 0.2) },
      { characterId: 3, resource: "energy", delta: 10 * 0.5 * (1 + 0.2) },
    ])
  })

  it("omits absent or zero gains", () => {
    expect(
      accrueForHit({ energy: 0, concerto: 0, forte: 0 }, actor, party),
    ).toEqual([])
    expect(accrueForHit({}, actor, party)).toEqual([])
  })
})
