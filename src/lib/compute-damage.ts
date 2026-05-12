import type { StatTable } from "#/types/stat-table"

export const DEF_MULT_CONST = 0.5
export const RES_MULT_CONST = 0.9

export type ScalingStat = "ATK" | "HP" | "DEF"

export interface DamageContext {
  multiplier: number
  element: string
  skillType: string
  dmgType: string
  scalingStat?: string
}

function normalizeScalingStat(raw: string | undefined): ScalingStat {
  if (!raw) return "ATK"
  const upper = raw.toUpperCase()
  if (upper === "HP" || upper === "DEF" || upper === "ATK") return upper
  return "ATK"
}

function scalingBase(stat: ScalingStat, stats: StatTable): number {
  switch (stat) {
    case "HP":
      return stats.hpBase * (1 + stats.hpPct) + stats.hpFlat
    case "DEF":
      return stats.defBase * (1 + stats.defPct) + stats.defFlat
    case "ATK":
      return stats.atkBase * (1 + stats.atkPct) + stats.atkFlat
  }
}

export function computeDamage(ctx: DamageContext, stats: StatTable): number {
  const stat = normalizeScalingStat(ctx.scalingStat)
  const base = scalingBase(stat, stats)
  const dmgBonus =
    (stats.elementBonus[ctx.element] ?? 0) +
    (stats.elementBonus["all"] ?? 0) +
    (stats.skillTypeBonus[ctx.skillType] ?? 0) +
    stats.allDmgBonus
  const deepen = stats.deepen[ctx.dmgType] ?? 0
  const critRate = Math.min(stats.critRate, 1)
  const critFactor = 1 - critRate + critRate * stats.critDmg

  // DEF_MULT_CONST = charDef / (charDef + enemyDef); defShred reduces enemy DEF portion
  const defMult =
    DEF_MULT_CONST /
    (DEF_MULT_CONST + (1 - DEF_MULT_CONST) * (1 - stats.defShred))

  // RES_MULT_CONST = 1 - baseResistance; resShred lowers effective resistance
  // When effective resistance goes negative the negative portion is halved
  const baseResist = 1 - RES_MULT_CONST
  const elementResShred = stats.resShred[ctx.element] ?? 0
  const effectiveResist = baseResist - elementResShred
  const resMult =
    effectiveResist >= 0 ? 1 - effectiveResist : 1 - effectiveResist / 2

  const raw =
    ctx.multiplier *
    base *
    (1 + dmgBonus) *
    (1 + deepen) *
    critFactor *
    defMult *
    resMult

  return Math.round(raw)
}
