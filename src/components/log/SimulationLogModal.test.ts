import { describe, expect, it } from "vitest"
import type { SkillType } from "#/types/character"
import type { ActiveBuff } from "#/types/simulation-log"
import { emptyStatTable } from "#/types/stat-table"
import type { StatTable } from "#/types/stat-table"
import {
  formatActiveBuffLabel,
  formatDeepenCell,
  formatDMGPctCell,
  formatStatComponents,
  computeFormulaBreakdown,
} from "#/lib/damage/hit-formula"

const snap = (over: Partial<StatTable> = {}): StatTable => ({
  ...emptyStatTable(),
  atkBase: 1500,
  atkPct: 0.3,
  atkFlat: 154,
  ...over,
})

const resolveName = (id: number) => `Char${id}`

describe("formatActiveBuffLabel", () => {
  it("unknown prefix — no tag, no stacks suffix", () => {
    const b: ActiveBuff = { id: "a.buff", name: "Power Up", stacks: 1 }
    expect(formatActiveBuffLabel(b, resolveName)).toBe("Power Up")
  })

  it("multi-stack buff — appends ×N suffix", () => {
    const b: ActiveBuff = { id: "a.buff", name: "Power Up", stacks: 3 }
    expect(formatActiveBuffLabel(b, resolveName)).toBe("Power Up ×3")
  })

  it("char prefix — emits character name tag", () => {
    const b: ActiveBuff = {
      id: "char.cosmos-rave",
      name: "Cosmos Rave",
      stacks: 1,
      sourceCharacterId: 1,
    }
    expect(formatActiveBuffLabel(b, resolveName)).toBe("[Char1] Cosmos Rave")
  })

  it("char prefix with stacks — tag + stacks suffix", () => {
    const b: ActiveBuff = {
      id: "char.fairy-tale",
      name: "Wooly's Fairy Tale",
      stacks: 3,
      sourceCharacterId: 2,
    }
    expect(formatActiveBuffLabel(b, resolveName)).toBe(
      "[Char2] Wooly's Fairy Tale ×3",
    )
  })

  it("weapon prefix — emits [Weapon] tag", () => {
    const b: ActiveBuff = {
      id: "weapon.electric-amp",
      name: "Electric Amplification (ATK)",
      stacks: 2,
    }
    expect(formatActiveBuffLabel(b, resolveName)).toBe(
      "[Weapon] Electric Amplification (ATK) ×2",
    )
  })

  it("echo prefix — emits [Echo] tag", () => {
    const b: ActiveBuff = { id: "echo.atk-boost", name: "ATK Boost", stacks: 1 }
    expect(formatActiveBuffLabel(b, resolveName)).toBe("[Echo] ATK Boost")
  })

  it("echo-set prefix — emits [Set] tag (not [Echo])", () => {
    const b: ActiveBuff = {
      id: "echo-set.molten-rift-2pc",
      name: "Molten Rift (2pc)",
      stacks: 1,
    }
    expect(formatActiveBuffLabel(b, resolveName)).toBe(
      "[Set] Molten Rift (2pc)",
    )
  })

  it("skill-tree prefix — emits [Tree] tag", () => {
    const b: ActiveBuff = {
      id: "skill-tree.atk",
      name: "ATK",
      stacks: 1,
    }
    expect(formatActiveBuffLabel(b, resolveName)).toBe("[Tree] ATK")
  })
})

describe("formatDMGPctCell", () => {
  it("sums elementBonus + skillTypeBonus + allDmgBonus", () => {
    const s = snap({
      elementBonus: { ...emptyStatTable().elementBonus, Fusion: 0.3 },
      skillTypeBonus: {
        ...emptyStatTable().skillTypeBonus,
        "Basic Attack": 0.2,
      },
      allDmgBonus: 0.15,
    })
    expect(formatDMGPctCell(s, "Fusion", "Basic Attack")).toBe("+65%")
  })

  it("0 bonus shows +0%", () => {
    expect(formatDMGPctCell(snap(), "Fusion", "Basic Attack")).toBe("+0%")
  })

  it("only matching element contributes", () => {
    const s = snap({
      elementBonus: {
        ...emptyStatTable().elementBonus,
        Glacio: 0.5,
        Fusion: 0.1,
      },
    })
    expect(formatDMGPctCell(s, "Fusion", "Basic Attack")).toBe("+10%")
  })
})

describe("formatDeepenCell", () => {
  it("0 deepen shows +0%", () =>
    expect(formatDeepenCell(snap(), "Fusion", "Basic Attack")).toBe("+0%"))
  it("matching skillTypeDeepen shown", () => {
    const s = snap({
      skillTypeDeepen: {
        ...emptyStatTable().skillTypeDeepen,
        "Basic Attack": 0.2,
      },
    })
    expect(formatDeepenCell(s, "Fusion", "Basic Attack")).toBe("+20%")
  })
  it("non-matching skill type shows +0%", () => {
    const s = snap({
      skillTypeDeepen: {
        ...emptyStatTable().skillTypeDeepen,
        "Resonance Skill": 0.3,
      },
    })
    expect(formatDeepenCell(s, "Fusion", "Basic Attack")).toBe("+0%")
  })
  it("elementDeepen + allDeepen sum into deepen cell", () => {
    const s = snap({
      elementDeepen: { ...emptyStatTable().elementDeepen, Fusion: 0.1 },
      allDeepen: 0.05,
    })
    expect(formatDeepenCell(s, "Fusion", "Basic Attack")).toBe("+15%")
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
  it("zero defShred gives DEF_MULT_CONST (0.5) as defMult", () => {
    const s = snap({ defShred: 0 })
    const ev = {
      damage: 0,
      element: "Fusion" as const,
      dmgType: "Damage",
      skillType: "Basic Attack" as SkillType,
      multiplier: 1,
      statsSnapshot: s,
    }
    const bd = computeFormulaBreakdown(ev)
    expect(bd.defMult).toBeCloseTo(0.5)
  })

  it("non-zero defShred increases defMult beyond 0.5", () => {
    const s = snap({ defShred: 0.2 })
    const ev = {
      damage: 0,
      element: "Fusion" as const,
      dmgType: "Damage",
      skillType: "Basic Attack" as SkillType,
      multiplier: 1,
      statsSnapshot: s,
    }
    const bd = computeFormulaBreakdown(ev)
    expect(bd.defMult).toBeGreaterThan(0.5)
  })
})
