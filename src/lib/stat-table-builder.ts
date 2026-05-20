import type { Element } from "#/data/elements"
import type { BuffDef, StatPath, ValueExpr } from "#/types/buff"
import type { EnrichedCharacter, SkillType } from "#/types/character"
import type {
  Cost3Main,
  Cost4Main,
  EchoBuild,
  SlotLoadout,
} from "#/types/loadout"
import type { StatTable } from "#/types/stat-table"
import { emptyStatTable } from "#/types/stat-table"
import type { WeaponData } from "#/types/weapon"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_BUILD_LAYOUT,
  ECHO_MAIN_1COST_SCALING,
  ECHO_MAIN_3COST_VARIABLE,
  ECHO_MAIN_4COST_VARIABLE,
  ECHO_MAIN_FIXED,
  ECHO_SUBSTAT,
} from "./echo-stat-constants"

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
  if (value.snapshot && snapshots) {
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
    allDmgBonus: s.allDmgBonus,
    elementDeepen: { ...s.elementDeepen },
    skillTypeDeepen: { ...s.skillTypeDeepen },
    allDeepen: s.allDeepen,
    shreds: { ...s.shreds },
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
    case "allDeepen":
    case "energyRechargePct":
    case "healingBonus":
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

function accumulateEchoSubstatBlock(
  stats: StatTable,
  character: EnrichedCharacter,
  primaryScalingStat: "atk" | "hp" | "def",
): void {
  stats.critRate += DEFAULT_SUBSTAT_ROLLS.critRate * ECHO_SUBSTAT.critRate
  stats.critDmg += DEFAULT_SUBSTAT_ROLLS.critDmg * ECHO_SUBSTAT.critDmg
  if (primaryScalingStat === "atk") {
    stats.atkPct += DEFAULT_SUBSTAT_ROLLS.scalingMain * ECHO_SUBSTAT.atkPct
  } else if (primaryScalingStat === "hp") {
    stats.hpPct += DEFAULT_SUBSTAT_ROLLS.scalingMain * ECHO_SUBSTAT.hpPct
  } else {
    stats.defPct += DEFAULT_SUBSTAT_ROLLS.scalingMain * ECHO_SUBSTAT.defPct
  }
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
  const scalingVal = ECHO_MAIN_1COST_SCALING[primaryScalingStat]
  if (primaryScalingStat === "atk") stats.atkPct += layout.cost1 * scalingVal
  else if (primaryScalingStat === "hp") stats.hpPct += layout.cost1 * scalingVal
  else stats.defPct += layout.cost1 * scalingVal
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
      if (primaryScalingStat === "atk") {
        stats.atkPct += ECHO_MAIN_4COST_VARIABLE.scalingAtk
      } else if (primaryScalingStat === "hp") {
        stats.hpPct += ECHO_MAIN_4COST_VARIABLE.scalingHp
      } else {
        stats.defPct += ECHO_MAIN_4COST_VARIABLE.scalingDef
      }
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
      if (primaryScalingStat === "atk") {
        stats.atkPct += ECHO_MAIN_3COST_VARIABLE.scalingAtk
      } else if (primaryScalingStat === "hp") {
        stats.hpPct += ECHO_MAIN_3COST_VARIABLE.scalingHp
      } else {
        stats.defPct += ECHO_MAIN_3COST_VARIABLE.scalingDef
      }
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
