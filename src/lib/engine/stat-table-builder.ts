import type { Element } from "#/data/elements"
import type {
  BuffDef,
  HitContext,
  HitFilter,
  StatPath,
  ValueExpr,
} from "#/types/buff"
import type { EnrichedCharacter, SkillType } from "#/types/character"
import type {
  Cost3Main,
  Cost4Main,
  EchoBuild,
  SlotLoadout,
} from "#/types/loadout"
import type { ScalarStatKey, StatTable } from "#/types/stat-table"
import { emptyStatTable } from "#/types/stat-table"
import type { WeaponData } from "#/types/weapon"
import { stageIdMatches } from "../stage"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_BUILD_LAYOUT,
  ECHO_MAIN_1COST_SCALING,
  ECHO_MAIN_3COST_VARIABLE,
  ECHO_MAIN_4COST_VARIABLE,
  ECHO_MAIN_FIXED,
  ECHO_SUBSTAT,
} from "../loadout/echo-stat-constants"

/**
 * Every character has these as an intrinsic floor before any echo/weapon/buff
 * contribution. Applied in `compileBaseStats`.
 */
const CHARACTER_BASE_CRIT_RATE = 0.05
const CHARACTER_BASE_CRIT_DMG = 1.5

export type StatContribution = {
  def: BuffDef
  stacks: number
  snapshots?: Record<number, number>
}

function matchesAxis<T>(
  filterVal: T | T[] | undefined,
  ctxVal: T | undefined,
): boolean {
  if (filterVal === undefined) return true
  if (ctxVal === undefined) return false
  return Array.isArray(filterVal)
    ? filterVal.includes(ctxVal)
    : filterVal === ctxVal
}

/**
 * Match the `stageId` Hit Filter axis. Unlike the other axes (exact/includes),
 * a filter id without a `.<hitIndex>` suffix matches any hit of that stage
 * lineage — the same semantics trigger matching uses (see `stageIdMatches`).
 */
function matchesStageIdAxis(
  filterVal: string | string[] | undefined,
  ctxVal: string | undefined,
): boolean {
  if (filterVal === undefined) return true
  if (ctxVal === undefined) return false
  const ids = Array.isArray(filterVal) ? filterVal : [filterVal]
  return ids.some((t) => stageIdMatches(t, ctxVal))
}

/** Returns true when every present axis in `filter` matches `ctx`. */
export function matchesHit(filter: HitFilter, ctx: HitContext): boolean {
  return (
    matchesAxis(filter.sourceBuffId, ctx.sourceBuffId) &&
    matchesStageIdAxis(filter.stageId, ctx.stageId) &&
    matchesAxis(filter.skillType, ctx.skillType) &&
    matchesAxis(filter.skillCategory, ctx.skillCategory) &&
    matchesAxis(filter.element, ctx.element)
  )
}

/**
 * Single accumulator for turning a contribution's Stat Effects into Stat Table
 * field writes. Used by both bootstrap (folding permanent buffs into the base
 * table) and resolveStats (layering active instances per query).
 */
export function accumulateStatEffects(
  stats: StatTable,
  contribution: StatContribution,
  getCharStat?: (characterId: number, stat: ScalarStatKey) => number,
  getBuffStacks?: (characterId: number, buffId: string) => number,
): void {
  const { def, stacks, snapshots } = contribution
  for (let i = 0; i < def.effects.length; i++) {
    const effect = def.effects[i]
    if (effect.kind !== "stat") continue
    const v = resolveValue(
      effect.value,
      stacks,
      snapshots,
      i,
      getCharStat,
      getBuffStacks,
    )
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
  getBuffStacks?: (characterId: number, buffId: string) => number,
): Record<number, number> | undefined {
  let out: Record<number, number> | undefined
  for (let i = 0; i < def.effects.length; i++) {
    const effect = def.effects[i]
    if (effect.kind !== "stat") continue
    const value = effect.value
    // `scaledByStat` is always read live (never frozen).
    if (value.kind === "scaledByStat") continue
    if (!value.snapshot) continue
    let frozen: number
    if (value.kind === "scaledByStacks") {
      const n = getBuffStacks?.(value.characterId, value.buffId) ?? 0
      frozen = value.base + value.per * Math.min(n, value.max)
    } else {
      frozen = value.kind === "perStack" ? value.v * stacks : value.v
    }
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
  getCharStat?: (characterId: number, stat: ScalarStatKey) => number,
  getBuffStacks?: (characterId: number, buffId: string) => number,
): number {
  if ("snapshot" in value && value.snapshot && snapshots) {
    return snapshots[effectIndex]
  }
  switch (value.kind) {
    case "const":
      return value.v
    case "perStack":
      return value.v * stacks
    case "scaledByStat": {
      const raw = getCharStat?.(value.characterId, value.stat) ?? 0
      const statVal = (value.base ?? 0) + raw
      return Math.min((statVal / value.per) * value.scale, value.max)
    }
    case "scaledByStacks": {
      const n = getBuffStacks?.(value.characterId, value.buffId) ?? 0
      return value.base + value.per * Math.min(n, value.max)
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
    elementDeepen: { ...s.elementDeepen },
    skillTypeDeepen: { ...s.skillTypeDeepen },
    allDeepen: s.allDeepen,
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
    case "allDeepen":
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
    case "elementDeepen":
      stats.elementDeepen[path.key] += v
      return
    case "skillTypeDeepen":
      stats.skillTypeDeepen[path.key] += v
      return
    case "shred":
      stats.shreds[path.key] += v
      return
  }
}

/** The Stat Table percent field a character's primary scaling stat rolls into. */
function scalingPctKey(
  primaryScalingStat: "atk" | "hp" | "def",
): "atkPct" | "hpPct" | "defPct" {
  return primaryScalingStat === "atk"
    ? "atkPct"
    : primaryScalingStat === "hp"
      ? "hpPct"
      : "defPct"
}

function accumulateEchoSubstatBlock(
  stats: StatTable,
  character: EnrichedCharacter,
  primaryScalingStat: "atk" | "hp" | "def",
): void {
  stats.critRate += DEFAULT_SUBSTAT_ROLLS.critRate * ECHO_SUBSTAT.critRate
  stats.critDmg += DEFAULT_SUBSTAT_ROLLS.critDmg * ECHO_SUBSTAT.critDmg
  const pctKey = scalingPctKey(primaryScalingStat)
  stats[pctKey] += DEFAULT_SUBSTAT_ROLLS.scalingMain * ECHO_SUBSTAT[pctKey]
  stats.energyRechargePct +=
    DEFAULT_SUBSTAT_ROLLS.energyRechargePct * ECHO_SUBSTAT.energyRechargePct
  const skillType: SkillType =
    character.recommendedSkillDmgPriority ?? "Resonance Liberation"
  stats.skillTypeBonus[skillType] +=
    DEFAULT_SUBSTAT_ROLLS.skillDmgBonus * ECHO_SUBSTAT.skillDmgBonus
}

function accumulateEchoMainBlock(
  stats: StatTable,
  echoBuild: EchoBuild,
  primaryScalingStat: "atk" | "hp" | "def",
): void {
  const layout = ECHO_BUILD_LAYOUT[echoBuild]
  stats.atkFlat +=
    layout.cost4 * ECHO_MAIN_FIXED.cost4FlatAtk +
    layout.cost3 * ECHO_MAIN_FIXED.cost3FlatAtk
  stats.hpFlat += layout.cost1 * ECHO_MAIN_FIXED.cost1FlatHp
  stats[scalingPctKey(primaryScalingStat)] +=
    layout.cost1 * ECHO_MAIN_1COST_SCALING[primaryScalingStat]
}

function accumulateCost4Mains(
  stats: StatTable,
  cost4Mains: Cost4Main[],
  primaryScalingStat: "atk" | "hp" | "def",
): void {
  for (const main of cost4Mains) {
    if (main === "cr") {
      stats.critRate += ECHO_MAIN_4COST_VARIABLE.cr
    } else if (main === "cd") {
      stats.critDmg += ECHO_MAIN_4COST_VARIABLE.cd
    } else {
      stats[scalingPctKey(primaryScalingStat)] +=
        ECHO_MAIN_4COST_VARIABLE.scaling[primaryScalingStat]
    }
  }
}

function accumulateCost3Mains(
  stats: StatTable,
  cost3Mains: Cost3Main[],
  primaryScalingStat: "atk" | "hp" | "def",
  characterElement: Element,
): void {
  for (const main of cost3Mains) {
    if (main === "er") {
      stats.energyRechargePct += ECHO_MAIN_3COST_VARIABLE.er
    } else if (main === "elemDmg") {
      stats.elementBonus[characterElement] += ECHO_MAIN_3COST_VARIABLE.elemDmg
    } else {
      stats[scalingPctKey(primaryScalingStat)] +=
        ECHO_MAIN_3COST_VARIABLE.scaling[primaryScalingStat]
    }
  }
}

function applyWeaponIntrinsic(
  stats: StatTable,
  value: number,
  statName: string,
): void {
  switch (statName) {
    case "ATK":
      stats.atkBase += value
      return
    case "Crit. Rate":
      stats.critRate += value
      return
    case "Crit. DMG":
      stats.critDmg += value
      return
    case "Energy Regen":
      stats.energyRechargePct += value
      return
  }
}

export function compileBaseStats(
  character: EnrichedCharacter,
  loadout: SlotLoadout | null,
  weapon: WeaponData | null,
): StatTable {
  const primaryScalingStat = character.primaryScalingStat ?? "atk"
  const stats: StatTable = {
    ...emptyStatTable(),
    atkBase: character.stats.max.atk,
    hpBase: character.stats.max.hp,
    defBase: character.stats.max.def,
    critRate: CHARACTER_BASE_CRIT_RATE,
    critDmg: CHARACTER_BASE_CRIT_DMG,
  }
  accumulateEchoSubstatBlock(stats, character, primaryScalingStat)
  accumulateEchoMainBlock(
    stats,
    loadout?.echoBuild ?? "4-3-3-1-1",
    primaryScalingStat,
  )
  accumulateCost4Mains(stats, loadout?.cost4Mains ?? ["cd"], primaryScalingStat)
  accumulateCost3Mains(
    stats,
    loadout?.cost3Mains ?? ["elemDmg", "elemDmg"],
    primaryScalingStat,
    character.element,
  )
  if (weapon) {
    applyWeaponIntrinsic(stats, weapon.stats.main.max, weapon.stats.main.name)
    applyWeaponIntrinsic(stats, weapon.stats.sub.max, weapon.stats.sub.name)
  }
  return stats
}
