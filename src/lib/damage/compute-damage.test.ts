import { describe, expect, it } from "vitest"
import { emptyStatTable } from "#/types/stat-table"
import type { StatTable } from "#/types/stat-table"
import { computeDamage, DEF_MULT_CONST, RES_MULT_CONST } from "./compute-damage"
import type { DamageContext } from "./compute-damage"

const DEFRES = DEF_MULT_CONST * RES_MULT_CONST

const ctx = (over: Partial<DamageContext> = {}): DamageContext => ({
  multiplier: 1,
  element: "Fusion",
  skillType: "Basic Attack",
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

  it("atkPct and atkFlat compose additively: ATK_eff = (atkBase × (1+atkPct)) + atkFlat", () => {
    expect(
      computeDamage(
        ctx({ multiplier: 1 }),
        stats({ atkPct: 0.5, atkFlat: 200 }),
      ),
    ).toBe(Math.round(1 * (1500 + 200) * DEFRES))
  })

  it("element bonus and skillType bonus share one additive bucket", () => {
    const s = stats({
      elementBonus: { ...emptyStatTable().elementBonus, Fusion: 0.3 },
      skillTypeBonus: {
        ...emptyStatTable().skillTypeBonus,
        "Basic Attack": 0.2,
      },
    })
    expect(computeDamage(ctx(), s)).toBe(
      Math.round(1 * 1000 * (1 + 0.5) * DEFRES),
    )
  })

  it("only element matching ctx.element contributes", () => {
    const s = stats({
      elementBonus: {
        ...emptyStatTable().elementBonus,
        Glacio: 0.4,
        Fusion: 0.1,
      },
    })
    expect(computeDamage(ctx({ element: "Fusion" }), s)).toBe(
      Math.round(1 * 1000 * 1.1 * DEFRES),
    )
  })

  it("allDmgBonus stacks additively with element bonus into the dmgBonus bucket", () => {
    const s = stats({
      elementBonus: { ...emptyStatTable().elementBonus, Fusion: 0.1 },
      allDmgBonus: 0.12,
    })
    expect(computeDamage(ctx({ element: "Fusion" }), s)).toBe(
      Math.round(1 * 1000 * (1 + 0.1 + 0.12) * DEFRES),
    )
  })

  it("skillTypeDeepen applies as its own multiplicative factor on matching skillType", () => {
    const s = stats({
      skillTypeDeepen: {
        ...emptyStatTable().skillTypeDeepen,
        "Basic Attack": 0.25,
      },
    })
    expect(computeDamage(ctx({ skillType: "Basic Attack" }), s)).toBe(
      Math.round(1 * 1000 * 1.25 * DEFRES),
    )
  })

  it("allDeepen applies to every skill type equally", () => {
    const s = stats({ allDeepen: 0.2 })
    const expected = Math.round(1 * 1000 * 1.2 * DEFRES)
    expect(computeDamage(ctx({ skillType: "Basic Attack" }), s)).toBe(expected)
    expect(computeDamage(ctx({ skillType: "Resonance Skill" }), s)).toBe(
      expected,
    )
    expect(computeDamage(ctx({ skillType: "Outro Skill" }), s)).toBe(expected)
  })

  it("allDeepen and skillTypeDeepen stack additively before the factor", () => {
    const s = stats({
      skillTypeDeepen: {
        ...emptyStatTable().skillTypeDeepen,
        "Basic Attack": 0.1,
      },
      allDeepen: 0.2,
    })
    expect(computeDamage(ctx({ skillType: "Basic Attack" }), s)).toBe(
      Math.round(1 * 1000 * 1.3 * DEFRES),
    )
    expect(computeDamage(ctx({ skillType: "Resonance Skill" }), s)).toBe(
      Math.round(1 * 1000 * 1.2 * DEFRES),
    )
  })

  it("elementDeepen applies when element matches", () => {
    const s = stats({
      elementDeepen: { ...emptyStatTable().elementDeepen, Fusion: 0.15 },
    })
    expect(computeDamage(ctx({ element: "Fusion" }), s)).toBe(
      Math.round(1 * 1000 * 1.15 * DEFRES),
    )
    expect(computeDamage(ctx({ element: "Glacio" }), s)).toBe(
      Math.round(1 * 1000 * DEFRES),
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

  it("positive shred reduces resistance, increasing damage", () => {
    const resMult = RES_MULT_CONST + 0.05
    expect(
      computeDamage(
        ctx({ skillType: "Basic Attack" }),
        stats({ shreds: { ...emptyStatTable().shreds, "Basic Attack": 0.05 } }),
      ),
    ).toBe(Math.round(1000 * DEF_MULT_CONST * resMult))
  })

  it("shred only applies to matching skill type", () => {
    expect(
      computeDamage(
        ctx({ skillType: "Basic Attack" }),
        stats({ shreds: { ...emptyStatTable().shreds, "Heavy Attack": 0.5 } }),
      ),
    ).toBe(Math.round(1000 * DEF_MULT_CONST * RES_MULT_CONST))
  })

  it("shred pushing resistance below 0 halves the negative portion", () => {
    // base resist = 1 - RES_MULT_CONST = 0.1; shred = 0.2 → effectiveResist = -0.1
    // resMult = 1 - (-0.1 / 2) = 1.05
    expect(
      computeDamage(
        ctx({ skillType: "Basic Attack" }),
        stats({ shreds: { ...emptyStatTable().shreds, "Basic Attack": 0.2 } }),
      ),
    ).toBe(Math.round(1000 * DEF_MULT_CONST * 1.05))
  })

  it("bonusMultiplier and dmgBonus are independent multiplicative factors", () => {
    const s = stats({ bonusMultiplier: 0.5, allDmgBonus: 0.3 })
    expect(computeDamage(ctx({ multiplier: 1 }), s)).toBe(
      Math.round(1 * 1000 * 1.5 * 1.3 * DEFRES),
    )
  })

  it("vul applies as a standalone × (1 + vul) factor", () => {
    expect(computeDamage(ctx({ multiplier: 1 }), stats({ vul: 0.4 }))).toBe(
      Math.round(1 * 1000 * 1.4 * DEFRES),
    )
  })

  it("vul is its own multiplicative space, independent of dmgBonus and deepen", () => {
    const s = stats({ allDmgBonus: 0.3, allDeepen: 0.2, vul: 0.4 })
    expect(computeDamage(ctx({ multiplier: 1 }), s)).toBe(
      Math.round(1 * 1000 * (1 + 0.3) * (1 + 0.2) * (1 + 0.4) * DEFRES),
    )
  })

  it("a default target reproduces the historical def/res constants", () => {
    expect(computeDamage(ctx({ multiplier: 1 }), stats())).toBe(
      computeDamage(ctx({ multiplier: 1 }), stats(), {
        level: 100,
        defMultConst: DEF_MULT_CONST,
        resMultConst: RES_MULT_CONST,
      }),
    )
  })

  it("target params drive the def and res mitigation factors", () => {
    const target = { level: 90, defMultConst: 0.6, resMultConst: 0.8 }
    const defMult = 0.6 / (0.6 + (1 - 0.6) * 1)
    expect(computeDamage(ctx({ multiplier: 1 }), stats(), target)).toBe(
      Math.round(1 * 1000 * defMult * 0.8),
    )
  })

  describe("statusTick source", () => {
    const tickCtx = (stacks: number): DamageContext =>
      ctx({
        multiplier: 99,
        element: "Aero",
        source: {
          kind: "statusTick",
          baseUnit: 2000,
          stacks,
          stackFactor: { 1: 0.8, 2: 2, 3: 4 },
        },
      })

    it("builds a flat baseUnit × stackFactor base, ignoring multiplier and scaling", () => {
      expect(computeDamage(tickCtx(3), stats({ atkBase: 9999 }))).toBe(
        Math.round(2000 * 4 * DEFRES),
      )
    })

    it("forces crit off (crit term collapses to ×1)", () => {
      const s = stats({ critRate: 1, critDmg: 3 })
      expect(computeDamage(tickCtx(2), s)).toBe(Math.round(2000 * 2 * DEFRES))
    })

    it("ignores skill-type bonus/deepen but applies element/all dmgBonus, deepen, and vul", () => {
      const s = stats({
        elementBonus: { ...emptyStatTable().elementBonus, Aero: 0.3 },
        skillTypeBonus: {
          ...emptyStatTable().skillTypeBonus,
          "Basic Attack": 0.5,
        },
        allDeepen: 0.2,
        skillTypeDeepen: {
          ...emptyStatTable().skillTypeDeepen,
          "Basic Attack": 0.5,
        },
        vul: 0.4,
      })
      expect(computeDamage(tickCtx(1), s)).toBe(
        Math.round(2000 * 0.8 * 1.3 * 1.2 * 1.4 * DEFRES),
      )
    })
  })
})
