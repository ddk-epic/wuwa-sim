import type { StatTable } from "#/types/stat-table"

export type HealScalingStat = "ATK" | "HP" | "DEF"

export interface HealContext {
  multiplier: number
  scalingStat?: string
  flat?: number
}

function normalizeScalingStat(raw: string | undefined): HealScalingStat {
  if (!raw) return "ATK"
  const upper = raw.toUpperCase()
  if (upper === "HP" || upper === "DEF" || upper === "ATK") return upper
  return "ATK"
}

function scalingBase(stat: HealScalingStat, stats: StatTable): number {
  switch (stat) {
    case "HP":
      return stats.hpBase * (1 + stats.hpPct) + stats.hpFlat
    case "DEF":
      return stats.defBase * (1 + stats.defPct) + stats.defFlat
    case "ATK":
      return stats.atkBase * (1 + stats.atkPct) + stats.atkFlat
  }
}

/** heal = (scalingStat × multiplier + flat) × (1 + healingBonus) */
export function computeHealing(ctx: HealContext, stats: StatTable): number {
  const stat = normalizeScalingStat(ctx.scalingStat)
  const base = scalingBase(stat, stats)
  const raw =
    (base * ctx.multiplier + (ctx.flat ?? 0)) * (1 + stats.healingBonus)
  return Math.round(raw)
}
