import type { BuffDef, StatPath, ValueExpr } from "#/types/buff"
import type { StatTable } from "#/types/stat-table"

export type StatContribution = {
  def: BuffDef
  stacks: number
  snapshots?: Record<number, number>
}

/**
 * Single accumulator for turning a contribution's Stat Effects into Stat Table
 * field writes. Used by both bootstrap (folding permanent buffs into the base
 * table) and resolveStats (layering active instances per query).
 */
export function accumulateStatEffects(
  stats: StatTable,
  contribution: StatContribution,
): void {
  const { def, stacks, snapshots } = contribution
  for (let i = 0; i < def.effects.length; i++) {
    const effect = def.effects[i]
    if (effect.kind !== "stat") continue
    const v = resolveValue(effect.value, stacks, snapshots, i)
    applyToPath(stats, effect.path, v)
  }
}

/**
 * Snapshot any `snapshot: true` ValueExpr at apply time so subsequent stack/
 * stat changes do not retroactively change the frozen contribution.
 */
export function freezeSnapshots(
  def: BuffDef,
  stacks: number,
): Record<number, number> | undefined {
  let out: Record<number, number> | undefined
  for (let i = 0; i < def.effects.length; i++) {
    const effect = def.effects[i]
    if (effect.kind !== "stat") continue
    if (!effect.value.snapshot) continue
    const frozen =
      effect.value.kind === "perStack"
        ? effect.value.v * stacks
        : effect.value.v
    if (!out) out = {}
    out[i] = frozen
  }
  return out
}

function resolveValue(
  value: ValueExpr,
  stacks: number,
  snapshots: Record<number, number> | undefined,
  effectIndex: number,
): number {
  if (value.snapshot && snapshots && snapshots[effectIndex] !== undefined) {
    return snapshots[effectIndex]
  }
  switch (value.kind) {
    case "const":
      return value.v
    case "perStack":
      return value.v * stacks
  }
}

export function cloneStats(s: StatTable): StatTable {
  return {
    atkBase: s.atkBase,
    atkPct: s.atkPct,
    atkFlat: s.atkFlat,
    hpBase: s.hpBase,
    hpPct: s.hpPct,
    hpFlat: s.hpFlat,
    defBase: s.defBase,
    defPct: s.defPct,
    defFlat: s.defFlat,
    critRate: s.critRate,
    critDmg: s.critDmg,
    defShred: s.defShred,
    elementBonus: { ...s.elementBonus },
    skillTypeBonus: { ...s.skillTypeBonus },
    deepens: { ...s.deepens },
    shreds: { ...s.shreds },
    allDmgBonus: s.allDmgBonus,
    energyRechargePct: s.energyRechargePct,
    healingBonus: s.healingBonus,
  }
}

function applyToPath(stats: StatTable, path: StatPath, v: number): void {
  switch (path.stat) {
    case "atkPct":
    case "atkFlat":
    case "hpPct":
    case "hpFlat":
    case "defPct":
    case "defFlat":
    case "critRate":
    case "critDmg":
    case "defShred":
    case "allDmgBonus":
    case "energyRechargePct":
    case "healingBonus":
      stats[path.stat] += v
      return
    case "elementBonus":
      stats.elementBonus[path.key] = (stats.elementBonus[path.key] ?? 0) + v
      return
    case "skillTypeBonus":
      stats.skillTypeBonus[path.key] += v
      return
    case "deepen":
      stats.deepens[path.key] = (stats.deepens[path.key] ?? 0) + v
      return
    case "shred":
      stats.shreds[path.key] += v
      return
  }
}
