import { describe, expect, it } from "vitest"
import { emptyStatTable } from "#/types/stat-table"
import type { StatTable } from "#/types/stat-table"
import { computeDamage, DEF_MULT_CONST, RES_MULT_CONST } from "./compute-damage"
import type { DamageContext } from "./compute-damage"

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

  it("scalingStat=HP scales by hpBase × (1+hpPct) + hpFlat", () => {
    const s = stats({
      atkBase: 1000,
      hpBase: 5000,
      hpPct: 0.4,
      hpFlat: 300,
    })
    expect(computeDamage(ctx({ multiplier: 1, scalingStat: "HP" }), s)).toBe(
      Math.round(1 * (5000 * 1.4 + 300) * DEFRES),
    )
  })

  it("scalingStat=DEF scales by defBase × (1+defPct) + defFlat", () => {
    const s = stats({
      atkBase: 1000,
      defBase: 800,
      defPct: 0.25,
      defFlat: 50,
    })
    expect(computeDamage(ctx({ multiplier: 1, scalingStat: "DEF" }), s)).toBe(
      Math.round(1 * (800 * 1.25 + 50) * DEFRES),
    )
  })

  it("missing scalingStat falls back to ATK", () => {
    expect(computeDamage(ctx({ multiplier: 1 }), stats({ atkPct: 0.5 }))).toBe(
      Math.round(1 * 1500 * DEFRES),
    )
  })

  it("unknown scalingStat falls back to ATK", () => {
    expect(
      computeDamage(
        ctx({ multiplier: 1, scalingStat: "WEIRD" }),
        stats({ atkPct: 0.5, hpBase: 9999 }),
      ),
    ).toBe(Math.round(1 * 1500 * DEFRES))
  })

  it("lowercase scalingStat is normalized", () => {
    const s = stats({ atkBase: 1000, hpBase: 5000 })
    expect(computeDamage(ctx({ multiplier: 1, scalingStat: "hp" }), s)).toBe(
      Math.round(1 * 5000 * DEFRES),
    )
  })

  it("allDmgBonus adds to dmgBonus regardless of element or skillType", () => {
    const s = stats({ allDmgBonus: 0.2 })
    expect(
      computeDamage(ctx({ element: "Glacio", skillType: "Heavy Attack" }), s),
    ).toBe(Math.round(1 * 1000 * 1.2 * DEFRES))
  })

  it("defShred=0 matches DEF_MULT_CONST baseline", () => {
    expect(computeDamage(ctx(), stats({ defShred: 0 }))).toBe(
      Math.round(1000 * DEF_MULT_CONST * RES_MULT_CONST),
    )
  })

  it("positive defShred increases damage (reduces enemy DEF contribution)", () => {
    const defMult =
      DEF_MULT_CONST / (DEF_MULT_CONST + (1 - DEF_MULT_CONST) * (1 - 0.2))
    expect(computeDamage(ctx(), stats({ defShred: 0.2 }))).toBe(
      Math.round(1000 * defMult * RES_MULT_CONST),
    )
  })

  it("multiple defShred sources stack additively (via combined scalar)", () => {
    const combined = 0.1 + 0.15
    const defMult =
      DEF_MULT_CONST / (DEF_MULT_CONST + (1 - DEF_MULT_CONST) * (1 - combined))
    expect(computeDamage(ctx(), stats({ defShred: combined }))).toBe(
      Math.round(1000 * defMult * RES_MULT_CONST),
    )
  })

  it("resShred=0 matches RES_MULT_CONST baseline", () => {
    expect(
      computeDamage(ctx({ element: "Fusion" }), stats({ resShred: {} })),
    ).toBe(Math.round(1000 * DEF_MULT_CONST * RES_MULT_CONST))
  })

  it("positive resShred reduces resistance, increasing damage", () => {
    const resMult = RES_MULT_CONST + 0.05
    expect(
      computeDamage(
        ctx({ element: "Fusion" }),
        stats({ resShred: { Fusion: 0.05 } }),
      ),
    ).toBe(Math.round(1000 * DEF_MULT_CONST * resMult))
  })

  it("resShred only applies to matching element", () => {
    expect(
      computeDamage(
        ctx({ element: "Fusion" }),
        stats({ resShred: { Glacio: 0.5 } }),
      ),
    ).toBe(Math.round(1000 * DEF_MULT_CONST * RES_MULT_CONST))
  })

  it("resShred pushing resistance below 0 halves the negative portion", () => {
    // base resist = 1 - RES_MULT_CONST = 0.1; resShred = 0.2 → effectiveResist = -0.1
    // resMult = 1 - (-0.1 / 2) = 1.05
    expect(
      computeDamage(
        ctx({ element: "Fusion" }),
        stats({ resShred: { Fusion: 0.2 } }),
      ),
    ).toBe(Math.round(1000 * DEF_MULT_CONST * 1.05))
  })
})
