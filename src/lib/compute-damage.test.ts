import { describe, expect, it } from "vitest"
import { emptyStatTable, type StatTable } from "#/types/stat-table"
import {
  computeDamage,
  DEF_MULT_CONST,
  RES_MULT_CONST,
  type DamageContext,
} from "./compute-damage"

const DEFRES = DEF_MULT_CONST * RES_MULT_CONST

const ctx = (over: Partial<DamageContext> = {}): DamageContext => ({
  multiplier: 1,
  element: "Fusion",
  skillType: "Normal Attack",
  dmgType: "Damage",
  ...over,
})

const stats = (over: Partial<StatTable> = {}): StatTable => ({
  ...emptyStatTable(),
  atkBase: 1000,
  ...over,
})

describe("computeDamage", () => {
  it("baseline: multiplier × atk × def/res constants only", () => {
    expect(computeDamage(ctx({ multiplier: 1.5 }), stats())).toBe(
      Math.round(1.5 * 1000 * DEFRES),
    )
  })

  it("applies atkPct additively to atkBase", () => {
    expect(computeDamage(ctx({ multiplier: 1 }), stats({ atkPct: 0.5 }))).toBe(
      Math.round(1 * 1500 * DEFRES),
    )
  })

  it("applies atkFlat after atkPct", () => {
    expect(
      computeDamage(
        ctx({ multiplier: 1 }),
        stats({ atkPct: 0.5, atkFlat: 200 }),
      ),
    ).toBe(Math.round(1 * (1500 + 200) * DEFRES))
  })

  it("element bonus and skillType bonus share one additive bucket", () => {
    const s = stats({
      elementBonus: { Fusion: 0.3 },
      skillTypeBonus: { "Normal Attack": 0.2 },
    })
    expect(computeDamage(ctx(), s)).toBe(
      Math.round(1 * 1000 * (1 + 0.5) * DEFRES),
    )
  })

  it("only element matching ctx.element contributes", () => {
    const s = stats({ elementBonus: { Glacio: 0.4, Fusion: 0.1 } })
    expect(computeDamage(ctx({ element: "Fusion" }), s)).toBe(
      Math.round(1 * 1000 * 1.1 * DEFRES),
    )
  })

  it("deepen applies as its own multiplicative factor on matching dmgType", () => {
    const s = stats({ deepen: { Damage: 0.25 } })
    expect(computeDamage(ctx({ dmgType: "Damage" }), s)).toBe(
      Math.round(1 * 1000 * 1.25 * DEFRES),
    )
  })

  it("crit at sub-cap applies expected-value (totalCritDamage used directly per reference)", () => {
    const s = stats({ critRate: 0.5, critDmg: 1.5 })
    expect(computeDamage(ctx(), s)).toBe(
      Math.round(1 * 1000 * (1 - 0.5 + 0.5 * 1.5) * DEFRES),
    )
  })

  it("crit rate is capped at 1.0 (overcap)", () => {
    const s = stats({ critRate: 1.5, critDmg: 2.0 })
    expect(computeDamage(ctx(), s)).toBe(
      Math.round(1 * 1000 * (1 - 1 + 1 * 2.0) * DEFRES),
    )
  })

  it("def and res constants always applied", () => {
    expect(computeDamage(ctx(), stats({ atkBase: 1 }))).toBe(
      Math.round(1 * DEFRES),
    )
  })
})
