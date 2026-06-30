import type { BuffDef } from "#/types/buff"
import type { Element } from "#/data/elements"
import type { EnrichedCharacter, SkillType } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type {
  Cost3Main,
  Cost4Main,
  EchoBuild,
  SlotLoadout,
} from "#/types/loadout"
import type { StatTable } from "#/types/stat-table"
import { getEchoSetById } from "./catalog"
import { compileEcho } from "#/lib/compile-character"
import {
  DEFAULT_ECHO_BUILD,
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_BUILDS,
  ECHO_MAIN_1COST_SCALING,
  ECHO_MAIN_3COST_VARIABLE,
  ECHO_MAIN_4COST_VARIABLE,
  ECHO_MAIN_FIXED,
  ECHO_SUBSTAT,
} from "./echo-stat-constants"

export interface ResolvedSet {
  setId: number
  effectivePieces: number
}

export function resolveEchoSets(
  slot1Id: number | null,
  slot2Id: number | null,
): ResolvedSet[] {
  const set1 = slot1Id !== null ? getEchoSetById(slot1Id) : null
  const set2 = slot2Id !== null ? getEchoSetById(slot2Id) : null

  if (!set1 && !set2) return []

  if (set1 && !set2) {
    return [
      {
        setId: set1.id,
        effectivePieces: set1.type === "three-only" ? 3 : 2,
      },
    ]
  }

  if (!set1 && set2) {
    return [
      {
        setId: set2.id,
        effectivePieces: set2.type === "three-only" ? 3 : 2,
      },
    ]
  }

  const s1 = set1!
  const s2 = set2!

  if (s1.type === "three-only" && s2.type === "three-only") {
    console.warn(
      `Invalid loadout: two 3-only echo sets (${s1.name}, ${s2.name}). Dropping slot 2.`,
    )
    return [{ setId: s1.id, effectivePieces: 3 }]
  }

  if (s1.type === "two-five" && s2.type === "two-five") {
    if (s1.id === s2.id) {
      return [{ setId: s1.id, effectivePieces: 5 }]
    }
    return [
      { setId: s1.id, effectivePieces: 2 },
      { setId: s2.id, effectivePieces: 2 },
    ]
  }

  if (s1.type === "two-five" && s2.type === "three-only") {
    return [
      { setId: s1.id, effectivePieces: 2 },
      { setId: s2.id, effectivePieces: 3 },
    ]
  }

  // s1.type === "three-only" && s2.type === "two-five"
  return [
    { setId: s1.id, effectivePieces: 3 },
    { setId: s2.id, effectivePieces: 2 },
  ]
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
    character.skillBonusPriority ?? "Resonance Liberation"
  stats.skillTypeBonus[skillType] +=
    DEFAULT_SUBSTAT_ROLLS.skillDmgBonus * ECHO_SUBSTAT.skillDmgBonus
}

function accumulateEchoMainBlock(
  stats: StatTable,
  echoBuild: EchoBuild,
  primaryScalingStat: "atk" | "hp" | "def",
): void {
  const layout = ECHO_BUILDS[echoBuild]
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

export function resolveEchoStats(
  stats: StatTable,
  character: EnrichedCharacter,
  loadout: SlotLoadout | null,
): void {
  const primaryScalingStat = character.primaryScalingStat ?? "atk"
  accumulateEchoSubstatBlock(stats, character, primaryScalingStat)
  accumulateEchoMainBlock(
    stats,
    loadout?.echoBuild ?? DEFAULT_ECHO_BUILD,
    primaryScalingStat,
  )
  accumulateCost4Mains(
    stats,
    loadout?.cost4Mains ?? ECHO_BUILDS[DEFAULT_ECHO_BUILD].cost4Default,
    primaryScalingStat,
  )
  accumulateCost3Mains(
    stats,
    loadout?.cost3Mains ?? ECHO_BUILDS[DEFAULT_ECHO_BUILD].cost3Default,
    primaryScalingStat,
    character.element,
  )
}

export function resolveEchoBuffs(echo: EnrichedEcho): BuffDef[] {
  return compileEcho(echo).buffs
}

export function resolveEchoSetBuffs(
  slot1Id: number | null,
  slot2Id: number | null,
): BuffDef[] {
  const buffs: BuffDef[] = []
  for (const { setId, effectivePieces } of resolveEchoSets(slot1Id, slot2Id)) {
    const echoSet = getEchoSetById(setId)
    if (echoSet) {
      for (const def of echoSet.buffs) {
        if ((def.requiresPieces ?? 2) <= effectivePieces) buffs.push(def)
      }
    }
  }
  return buffs
}
