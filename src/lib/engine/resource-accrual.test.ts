// @vitest-environment node
import { describe, expect, it } from "vitest"
import { accrueForHit } from "./resource-accrual"

const actor = { id: 1, er: 0.2, fr: 0.3 }
const party = [1, 2, 3]

describe("accrueForHit — pure resource gain rule", () => {
  it("produces no teammate share for synthetic gains", () => {
    const accruals = accrueForHit({ energy: 10, synthetic: true }, actor, party)
    expect(accruals).toEqual([
      { characterId: 1, resource: "energy", delta: 10 * (1 + 0.2) },
    ])
  })

  it("applies negative forte (consumption) raw — FR scales gains only", () => {
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

  it("scales actor energy by (1 + ER) × (1 + energyGainMult)", () => {
    const [first] = accrueForHit({ energy: 10 }, actor, party, 1.5)
    expect(first).toEqual({
      characterId: 1,
      resource: "energy",
      delta: 10 * (1 + 0.2) * (1 + 1.5),
    })
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

  it("energyFlat grants actor energy verbatim and shares it unscaled", () => {
    const accruals = accrueForHit({ energy: 10 }, actor, party, 1.5, true)
    expect(accruals).toEqual([
      { characterId: 1, resource: "energy", delta: 10 },
      { characterId: 2, resource: "energy", delta: 5 },
      { characterId: 3, resource: "energy", delta: 5 },
    ])
  })

  it("energyFlat leaves forte FR-scaled", () => {
    const accruals = accrueForHit(
      { energy: 10, forte: 4 },
      actor,
      party,
      0,
      true,
    )
    expect(accruals).toContainEqual({
      characterId: 1,
      resource: "forte",
      delta: 4 * (1 + 0.3),
    })
  })
})
