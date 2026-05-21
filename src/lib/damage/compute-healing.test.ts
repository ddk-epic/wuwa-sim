import { describe, expect, it } from "vitest"
import { emptyStatTable } from "#/types/stat-table"
import type { StatTable } from "#/types/stat-table"
import { computeHealing } from "./compute-healing"

const stats = (over: Partial<StatTable> = {}): StatTable => ({
  ...emptyStatTable(),
  atkBase: 1000,
  ...over,
})

describe("computeHealing", () => {
  it("baseline: multiplier × ATK + flat with no healingBonus", () => {
    expect(computeHealing({ multiplier: 0.1, flat: 200 }, stats())).toBe(
      Math.round(1000 * 0.1 + 200),
    )
  })

  it("healingBonus scales the entire (base × mult + flat) expression", () => {
    const s = stats({ healingBonus: 0.1 })
    expect(computeHealing({ multiplier: 0.2, flat: 500 }, s)).toBe(
      Math.round((1000 * 0.2 + 500) * 1.1),
    )
  })

  it("no flat: heal = base × multiplier × (1 + healingBonus)", () => {
    const s = stats({ healingBonus: 0.2 })
    expect(computeHealing({ multiplier: 0.3 }, s)).toBe(
      Math.round(1000 * 0.3 * 1.2),
    )
  })

  it("HP scaling uses hpBase × (1 + hpPct) + hpFlat", () => {
    const s = stats({ hpBase: 5000, hpPct: 0.4, hpFlat: 200 })
    const base = 5000 * 1.4 + 200
    expect(computeHealing({ multiplier: 0.05, scalingStat: "HP" }, s)).toBe(
      Math.round(base * 0.05),
    )
  })

  it("ATK scales through atkPct and atkFlat", () => {
    const s = stats({ atkBase: 1000, atkPct: 0.5, atkFlat: 100 })
    const base = 1000 * 1.5 + 100
    expect(
      computeHealing({ multiplier: 0.238, flat: 950, scalingStat: "ATK" }, s),
    ).toBe(Math.round(base * 0.238 + 950))
  })
})
