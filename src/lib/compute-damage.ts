import type { StatTable } from "#/types/stat-table"

export const DEF_MULT_CONST = 0.5
export const RES_MULT_CONST = 0.9

export interface DamageContext {
  multiplier: number
  element: string
  skillType: string
  dmgType: string
}

export function computeDamage(ctx: DamageContext, stats: StatTable): number {
  const atk = stats.atkBase * (1 + stats.atkPct) + stats.atkFlat
  const dmgBonus =
    (stats.elementBonus[ctx.element] ?? 0) +
    (stats.skillTypeBonus[ctx.skillType] ?? 0)
  const deepen = stats.deepen[ctx.dmgType] ?? 0
  const critRate = Math.min(stats.critRate, 1)
  const critFactor = 1 - critRate + critRate * stats.critDmg

  const raw =
    ctx.multiplier *
    atk *
    (1 + dmgBonus) *
    (1 + deepen) *
    critFactor *
    DEF_MULT_CONST *
    RES_MULT_CONST

  return Math.round(raw)
}
