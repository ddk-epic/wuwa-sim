import type {
  BuffDef,
  HitContext,
  HitFilter,
  StatPath,
  ValueExpr,
} from "#/types/buff"
import type { ScalarStatKey, StatTable } from "#/types/stat-table"
import type { NegStatusType } from "#/data/neg-status-types"
import type { HitLabel } from "#/data/hit-labels"

export type StatContribution = {
  def: BuffDef
  stacks: number
  snapshots?: Record<number, number>
}

export function matchesAxis<T>(
  filterVal: T | T[] | undefined,
  ctxVal: T | undefined,
): boolean {
  if (filterVal === undefined) return true
  if (ctxVal === undefined) return false
  return Array.isArray(filterVal)
    ? filterVal.includes(ctxVal)
    : filterVal === ctxVal
}

function matchesLabelAxis(
  filterVal: HitLabel | HitLabel[] | undefined,
  ctxLabels: HitLabel[] | undefined,
): boolean {
  if (filterVal === undefined) return true
  if (!ctxLabels || ctxLabels.length === 0) return false
  const wanted = Array.isArray(filterVal) ? filterVal : [filterVal]
  return wanted.some((l) => ctxLabels.includes(l))
}

/** Returns true when every present axis in `filter` matches `ctx`. */
export function matchesHit(filter: HitFilter, ctx: HitContext): boolean {
  return (
    matchesAxis(filter.sourceBuff, ctx.sourceBuffId) &&
    matchesAxis(filter.stageId, ctx.stageId) &&
    matchesAxis(filter.skill, ctx.skill) &&
    matchesAxis(filter.hitIndex, ctx.hitIndex) &&
    matchesAxis(filter.skillType, ctx.skillType) &&
    matchesAxis(filter.skillCategory, ctx.skillCategory) &&
    matchesAxis(filter.element, ctx.element) &&
    matchesLabelAxis(filter.label, ctx.labels)
  )
}

/**
 * Folds a contribution's intrinsic Stat Effects (everything except
 * `scaledByStat`) into the Stat Table. Used by bootstrap (folding permanent
 * buffs into the base table) and the intrinsic resolution pass. `scaledByStat`
 * effects are layered separately by `accumulateScaledStatEffects`.
 */
export function accumulateStatEffects(
  stats: StatTable,
  contribution: StatContribution,
  getBuffStacks?: (characterId: number, buffId: string) => number,
  getStatusStacks?: (status: NegStatusType) => number,
): void {
  const { def, stacks, snapshots } = contribution
  for (let i = 0; i < def.effects.length; i++) {
    const effect = def.effects[i]
    if (effect.kind !== "stat") continue
    if (effect.value.kind === "scaledByStat") continue
    const v = resolveValue(
      effect.value,
      stacks,
      snapshots,
      i,
      getBuffStacks,
      getStatusStacks,
    )
    applyToPath(stats, effect.path, v)
  }
}

/**
 * Layers a contribution's `scaledByStat` effects on top of an already-resolved
 * intrinsic table. `getCharStat` reads the *intrinsic* table of the referenced
 * character, so this pass can never re-enter stat resolution.
 */
export function accumulateScaledStatEffects(
  stats: StatTable,
  contribution: StatContribution,
  getCharStat: (characterId: number, stat: ScalarStatKey) => number,
): void {
  const { def } = contribution
  for (const effect of def.effects) {
    if (effect.kind !== "stat") continue
    if (effect.value.kind !== "scaledByStat") continue
    applyToPath(
      stats,
      effect.path,
      resolveScaledByStatValue(effect.value, getCharStat),
    )
  }
}

/**
 * Snapshot any `snapshot: true` ValueExpr at apply time so subsequent stack/
 * stat changes do not retroactively change the frozen contribution.
 */
export function freezeSnapshots(
  def: BuffDef,
  stacks: number,
  getBuffStacks?: (characterId: number, buffId: string) => number,
): Record<number, number> | undefined {
  let out: Record<number, number> | undefined
  for (let i = 0; i < def.effects.length; i++) {
    const effect = def.effects[i]
    if (effect.kind !== "stat") continue
    const value = effect.value
    // `scaledByStat` and `fromStatusStacks` are always read live (never frozen).
    if (value.kind === "scaledByStat") continue
    if (value.kind === "fromStatusStacks") continue
    if (!value.snapshot) continue
    let frozen: number
    if (value.kind === "scaledByStacks") {
      const n = getBuffStacks?.(value.characterId, value.buff) ?? 0
      frozen = value.base + value.per * Math.min(n, value.max)
    } else {
      frozen = value.kind === "perStack" ? value.v * stacks : value.v
    }
    if (!out) out = {}
    out[i] = frozen
  }
  return out
}

function resolveScaledByStatValue(
  value: Extract<ValueExpr, { kind: "scaledByStat" }>,
  getCharStat: (characterId: number, stat: ScalarStatKey) => number,
): number {
  const statVal = (value.base ?? 0) + getCharStat(value.characterId, value.stat)
  return Math.min((statVal / value.per) * value.scale, value.max)
}

function resolveValue(
  value: Exclude<ValueExpr, { kind: "scaledByStat" }>,
  stacks: number,
  snapshots: Record<number, number> | undefined,
  effectIndex: number,
  getBuffStacks?: (characterId: number, buffId: string) => number,
  getStatusStacks?: (status: NegStatusType) => number,
): number {
  if ("snapshot" in value && value.snapshot && snapshots) {
    return snapshots[effectIndex]
  }
  switch (value.kind) {
    case "const":
      return value.v
    case "perStack":
      return value.v * stacks
    case "scaledByStacks": {
      const n = getBuffStacks?.(value.characterId, value.buff) ?? 0
      return value.base + value.per * Math.min(n, value.max)
    }
    case "fromStatusStacks": {
      const n = getStatusStacks?.(value.status) ?? 0
      const capped = Math.min(n, value.max)
      return (
        value.base + value.per * Math.max(0, capped - (value.threshold ?? 0))
      )
    }
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
    allDmgBonus: s.allDmgBonus,
    elementAmp: { ...s.elementAmp },
    skillTypeAmp: { ...s.skillTypeAmp },
    allAmp: s.allAmp,
    shreds: { ...s.shreds },
    energyRechargePct: s.energyRechargePct,
    forteRechargePct: s.forteRechargePct,
    healingBonus: s.healingBonus,
    bonusMultiplier: s.bonusMultiplier,
    energyGainMult: s.energyGainMult,
    vul: s.vul,
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
    case "allAmp":
    case "energyRechargePct":
    case "forteRechargePct":
    case "healingBonus":
    case "bonusMultiplier":
    case "energyGainMult":
    case "vul":
      stats[path.stat] += v
      return
    case "elementBonus":
      stats.elementBonus[path.key] += v
      return
    case "skillTypeBonus":
      stats.skillTypeBonus[path.key] += v
      return
    case "elementAmp":
      stats.elementAmp[path.key] += v
      return
    case "skillTypeAmp":
      stats.skillTypeAmp[path.key] += v
      return
    case "shred":
      stats.shreds[path.key] += v
      return
  }
}
