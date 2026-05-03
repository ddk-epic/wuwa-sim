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

function applyToPath(stats: StatTable, path: StatPath, v: number): void {
  switch (path.stat) {
    case "atkBase":
    case "atkPct":
    case "atkFlat":
    case "critRate":
    case "critDmg":
    case "defShred":
      stats[path.stat] += v
      return
    case "elementBonus":
      stats.elementBonus[path.key] = (stats.elementBonus[path.key] ?? 0) + v
      return
    case "skillTypeBonus":
      stats.skillTypeBonus[path.key] = (stats.skillTypeBonus[path.key] ?? 0) + v
      return
    case "deepen":
      stats.deepen[path.key] = (stats.deepen[path.key] ?? 0) + v
      return
    case "resShred":
      stats.resShred[path.key] = (stats.resShred[path.key] ?? 0) + v
      return
  }
}
