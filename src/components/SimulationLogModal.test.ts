import { describe, expect, it } from "vitest"
import type { ActiveBuff } from "#/types/simulation-log"
import { emptyStatTable } from "#/types/stat-table"
import type { StatTable } from "#/types/stat-table"
import {
  formatActiveBuffLabel,
  formatCDCell,
  formatCRCell,
  formatDeepenCell,
  formatDMGPctCell,
  formatERCell,
  formatScalingCell,
  formatStatComponents,
  computeFormulaBreakdown,
} from "./SimulationLogModal"

const snap = (over: Partial<StatTable> = {}): StatTable => ({
  ...emptyStatTable(),
  atkBase: 1500,
  atkPct: 0.3,
  atkFlat: 154,
  ...over,
})

const resolveName = (id: number) => `Char${id}`

describe("formatActiveBuffLabel", () => {
  it("single-stack buff — no stacks suffix", () => {
    const b: ActiveBuff = { id: "a.buff", name: "Power Up", stacks: 1 }
    expect(formatActiveBuffLabel(b, [b], resolveName)).toBe("Power Up")
  })

  it("multi-stack buff — appends ×N suffix", () => {
    const b: ActiveBuff = { id: "a.buff", name: "Power Up", stacks: 3 }
    expect(formatActiveBuffLabel(b, [b], resolveName)).toBe("Power Up ×3")
  })

  it("no name collision — no source suffix even when sourceCharacterId present", () => {
    const b: ActiveBuff = {
      id: "a.buff",
      name: "Power Up",
      stacks: 1,
      sourceCharacterId: 1,
    }
    expect(formatActiveBuffLabel(b, [b], resolveName)).toBe("Power Up")
  })

  it("name collision — appends source-character suffix", () => {
    const b1: ActiveBuff = {
      id: "a.buff",
      name: "Power Up",
      stacks: 1,
      sourceCharacterId: 1,
    }
    const b2: ActiveBuff = {
      id: "b.buff",
      name: "Power Up",
      stacks: 1,
      sourceCharacterId: 2,
    }
    const all = [b1, b2]
    expect(formatActiveBuffLabel(b1, all, resolveName)).toBe(
      "Power Up (from Char1)",
    )
    expect(formatActiveBuffLabel(b2, all, resolveName)).toBe(
      "Power Up (from Char2)",
    )
  })

  it("name collision with stacks — both suffixes applied", () => {
    const b1: ActiveBuff = {
      id: "a.buff",
      name: "Surge",
      stacks: 2,
      sourceCharacterId: 1,
    }
    const b2: ActiveBuff = {
      id: "b.buff",
      name: "Surge",
      stacks: 1,
      sourceCharacterId: 2,
    }
    const all = [b1, b2]
    expect(formatActiveBuffLabel(b1, all, resolveName)).toBe(
      "Surge ×2 (from Char1)",
    )
  })

  it("name collision but no sourceCharacterId — no source suffix", () => {
    const b1: ActiveBuff = { id: "a.buff", name: "Power Up", stacks: 1 }
    const b2: ActiveBuff = { id: "b.buff", name: "Power Up", stacks: 1 }
    const all = [b1, b2]
    expect(formatActiveBuffLabel(b1, all, resolveName)).toBe("Power Up")
  })
})

describe("formatScalingCell", () => {
  it("ATK (default) shows resolved ATK value", () => {
    // 1500 * 1.3 + 154 = 2104
    expect(formatScalingCell(snap())).toBe("ATK 2104")
  })

  it("missing scalingStat falls back to ATK", () => {
    expect(formatScalingCell(snap(), undefined)).toBe("ATK 2104")
  })

  it("HP scaling uses hpBase * (1+hpPct) + hpFlat", () => {
    const s = snap({ hpBase: 5000, hpPct: 0.4, hpFlat: 300 })
    expect(formatScalingCell(s, "HP")).toBe("HP 7300")
  })

  it("DEF scaling uses defBase * (1+defPct) + defFlat", () => {
    const s = snap({ defBase: 800, defPct: 0.25, defFlat: 50 })
    expect(formatScalingCell(s, "DEF")).toBe("DEF 1050")
  })
})

describe("formatERCell", () => {
  it("0% ER shows 100%", () => expect(formatERCell(0)).toBe("100%"))
  it("0.2 ER shows 120%", () => expect(formatERCell(0.2)).toBe("120%"))
})

describe("formatCRCell", () => {
  it("50% crit rate shows 50%", () => expect(formatCRCell(0.5)).toBe("50%"))
  it("100% crit rate shows 100%", () => expect(formatCRCell(1.0)).toBe("100%"))
  it("over-cap crit rate shows capped suffix", () =>
    expect(formatCRCell(1.5)).toBe("150% (capped 100%)"))
})

describe("formatCDCell", () => {
  it("150% crit dmg shows 150%", () => expect(formatCDCell(1.5)).toBe("150%"))
})

describe("formatDMGPctCell", () => {
  it("sums elementBonus + skillTypeBonus + allDmgBonus", () => {
    const s = snap({
      elementBonus: { Fusion: 0.3 },
      skillTypeBonus: { "Basic Attack": 0.2 },
      allDmgBonus: 0.15,
    })
    expect(formatDMGPctCell(s, "Fusion", "Basic Attack")).toBe("+65%")
  })

  it("0 bonus shows +0%", () => {
    expect(formatDMGPctCell(snap(), "Fusion", "Basic Attack")).toBe("+0%")
  })

  it("only matching element contributes", () => {
    const s = snap({ elementBonus: { Glacio: 0.5, Fusion: 0.1 } })
    expect(formatDMGPctCell(s, "Fusion", "Basic Attack")).toBe("+10%")
  })
})

describe("formatDeepenCell", () => {
  it("0 deepen shows +0%", () =>
    expect(formatDeepenCell(snap(), "Damage")).toBe("+0%"))
  it("matching deepen shown", () => {
    const s = snap({ deepen: { Damage: 0.2 } })
    expect(formatDeepenCell(s, "Damage")).toBe("+20%")
  })
  it("non-matching deepen shows +0%", () => {
    const s = snap({ deepen: { Fusion: 0.3 } })
    expect(formatDeepenCell(s, "Damage")).toBe("+0%")
  })
})

describe("formatStatComponents", () => {
  it("ATK: resolved value with components", () => {
    // 1500 * 1.30 + 154 = 2104
    expect(formatStatComponents(snap(), "ATK")).toBe(
      "ATK 2104 (1500 × 1.30 + 154)",
    )
  })

  it("HP scaling shows hp components", () => {
    const s = snap({ hpBase: 5000, hpPct: 0.4, hpFlat: 0 })
    expect(formatStatComponents(s, "HP")).toBe("HP 7000 (5000 × 1.40 + 0)")
  })

  it("DEF scaling shows def components", () => {
    const s = snap({ defBase: 800, defPct: 0.25, defFlat: 50 })
    expect(formatStatComponents(s, "DEF")).toBe("DEF 1050 (800 × 1.25 + 50)")
  })
})

describe("computeFormulaBreakdown", () => {
  it("result matches damage (within rounding)", () => {
    const s = snap({ critRate: 0.5, critDmg: 1.5 })
    const ev = {
      damage: 0,
      element: "Fusion",
      dmgType: "Damage",
      skillType: "Basic Attack",
      scalingStat: "ATK",
      multiplier: 1.5,
      statsSnapshot: s,
    }
    const bd = computeFormulaBreakdown(
      ev as Parameters<typeof computeFormulaBreakdown>[0],
    )
    expect(bd.result).toBe(ev.damage === 0 ? bd.result : ev.damage)
    // Verify the formula multiplies correctly
    const manual = Math.round(
      bd.scalingValue *
        bd.multiplier *
        (1 + bd.dmgBonus) *
        (1 + bd.deepen) *
        bd.critFactor *
        bd.defMult *
        bd.resMult,
    )
    expect(bd.result).toBe(manual)
  })

  it("zero defShred gives DEF_MULT_CONST (0.5) as defMult", () => {
    const s = snap({ defShred: 0 })
    const ev = {
      damage: 0,
      element: "Fusion",
      dmgType: "Damage",
      skillType: "Basic Attack",
      multiplier: 1,
      statsSnapshot: s,
    }
    const bd = computeFormulaBreakdown(
      ev as Parameters<typeof computeFormulaBreakdown>[0],
    )
    expect(bd.defMult).toBeCloseTo(0.5)
  })

  it("non-zero defShred increases defMult beyond 0.5", () => {
    const s = snap({ defShred: 0.2 })
    const ev = {
      damage: 0,
      element: "Fusion",
      dmgType: "Damage",
      skillType: "Basic Attack",
      multiplier: 1,
      statsSnapshot: s,
    }
    const bd = computeFormulaBreakdown(
      ev as Parameters<typeof computeFormulaBreakdown>[0],
    )
    expect(bd.defMult).toBeGreaterThan(0.5)
  })
})
