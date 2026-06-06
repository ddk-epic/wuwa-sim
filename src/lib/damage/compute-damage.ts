import type { Element } from "#/data/elements"
import type { SkillType } from "#/types/character"
import type { StatTable } from "#/types/stat-table"
import type { TargetParams } from "#/types/target"
import { DEFAULT_TARGET_PARAMS } from "#/types/target"

export const DEF_MULT_CONST = 0.5
export const RES_MULT_CONST = 0.9

export type ScalingStat = "ATK" | "HP" | "DEF"

export interface DamageContext {
  multiplier: number
  element: Element
  skillType: SkillType
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

export function computeDamage(
  ctx: DamageContext,
  stats: StatTable,
  target: TargetParams = DEFAULT_TARGET_PARAMS,
): number {
  const stat = normalizeScalingStat(ctx.scalingStat)
  const base = scalingBase(stat, stats)
  const dmgBonus =
    stats.elementBonus[ctx.element] +
    stats.skillTypeBonus[ctx.skillType] +
    stats.allDmgBonus
  const deepen =
    stats.elementDeepen[ctx.element] +
    stats.skillTypeDeepen[ctx.skillType] +
    stats.allDeepen
  const critRate = Math.min(stats.critRate, 1)
  const critFactor = 1 - critRate + critRate * stats.critDmg

  const defConst = target.defMultConst
  const defMult = defConst / (defConst + (1 - defConst) * (1 - stats.defShred))

  const baseResist = 1 - target.resMultConst
  const skillResShred = stats.shreds[ctx.skillType]
  const effectiveResist = baseResist - skillResShred
  const resMult =
    effectiveResist >= 0 ? 1 - effectiveResist : 1 - effectiveResist / 2

  const raw =
    ctx.multiplier *
    base *
    (1 + stats.bonusMultiplier) *
    (1 + dmgBonus) *
    (1 + deepen) *
    (1 + stats.vul) *
    critFactor *
    defMult *
    resMult

  return Math.round(raw)
}
