import type { BuffDef, BuffInstance, StatPath } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { EnrichedEcho } from "#/types/echo"
import type { Cost4Main, EchoBuild, SlotLoadout } from "#/types/loadout"
import type { StatTable } from "#/types/stat-table"
import { emptyStatTable } from "#/types/stat-table"
import type { WeaponData } from "#/types/weapon"
import {
  getCharacterById,
  getEchoById,
  getEchoSetById,
  getWeaponById,
} from "./catalog"
import {
  DEFAULT_SUBSTAT_ROLLS,
  ECHO_BUILD_LAYOUT,
  ECHO_MAIN_1COST_SCALING,
  ECHO_MAIN_4COST_VARIABLE,
  ECHO_MAIN_FIXED,
  ECHO_SUBSTAT,
} from "./echo-stat-constants"
import { resolveEchoSets } from "./resolve-echo-sets"
import { accumulateStatEffects, freezeSnapshots } from "./stat-table-builder"
import { resolveWeaponBuffs } from "./weapon-resolve"

const ELEMENTS = ["Fusion", "Glacio", "Electro", "Aero", "Havoc", "Spectro"]

const FLAT_VALUE_BY_NAME: Record<string, { path: StatPath; v: number }> = {
  ATK: { path: { stat: "atkPct" }, v: 0.12 },
  HP: { path: { stat: "hpPct" }, v: 0.12 },
  DEF: { path: { stat: "defPct" }, v: 0.12 },
  "Crit. Rate": { path: { stat: "critRate" }, v: 0.08 },
  "Crit. DMG": { path: { stat: "critDmg" }, v: 0.16 },
}

export function compileSkillTreeNode(
  nodeName: string,
  ctx: { characterId: number; characterElement: string },
): BuffDef | null {
  const elementMatch = ELEMENTS.find((e) => nodeName === `${e} DMG Bonus`)
  if (elementMatch) {
    return {
      id: `skill-tree.${ctx.characterId}.${nodeName}`,
      name: nodeName,
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: elementMatch },
          value: { kind: "const", v: 0.12 },
        },
      ],
    }
  }

  const flat = FLAT_VALUE_BY_NAME[nodeName]
  if (flat) {
    return {
      id: `skill-tree.${ctx.characterId}.${nodeName}`,
      name: nodeName,
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: flat.path,
          value: { kind: "const", v: flat.v },
        },
      ],
    }
  }

  return null
}

export function buildCharacterBuffDefs(
  char: EnrichedCharacter,
  sequence: number,
): BuffDef[] {
  const buffs: BuffDef[] = []
  for (const def of char.buffs) {
    if ((def.requiresSequence ?? 0) <= sequence) buffs.push(def)
  }
  for (const nodeName of char.skillTreeBonuses) {
    const def = compileSkillTreeNode(nodeName, {
      characterId: char.id,
      characterElement: char.element,
    })
    if (def) buffs.push(def)
  }
  return buffs
}

export function buildWeaponBuffDefs(
  weapon: WeaponData,
  rank: number,
): BuffDef[] {
  return resolveWeaponBuffs(weapon, rank)
}

export function buildEchoBuffDefs(echo: EnrichedEcho): BuffDef[] {
  return echo.buffs
}

export function buildEchoSetBuffDefs(
  slot1Id: number | null,
  slot2Id: number | null,
): BuffDef[] {
  const buffs: BuffDef[] = []
  const resolvedSets = resolveEchoSets(slot1Id, slot2Id)
  for (const { setId, effectivePieces } of resolvedSets) {
    const echoSet = getEchoSetById(setId)
    if (echoSet) {
      for (const def of echoSet.buffs) {
        if ((def.requiresPieces ?? 2) <= effectivePieces) buffs.push(def)
      }
    }
  }
  return buffs
}

export function accumulateEchoSubstatBlock(
  stats: StatTable,
  character: EnrichedCharacter,
): void {
  stats.critRate += DEFAULT_SUBSTAT_ROLLS.critRate * ECHO_SUBSTAT.critRate
  stats.critDmg += DEFAULT_SUBSTAT_ROLLS.critDmg * ECHO_SUBSTAT.critDmg
  stats.atkPct += DEFAULT_SUBSTAT_ROLLS.atkPct * ECHO_SUBSTAT.atkPct
  stats.energyRechargePct +=
    DEFAULT_SUBSTAT_ROLLS.energyRechargePct * ECHO_SUBSTAT.energyRechargePct
  const skillType =
    character.recommendedSkillDmgPriority ?? "Resonance Liberation"
  stats.skillTypeBonus[skillType] =
    (stats.skillTypeBonus[skillType] ?? 0) +
    DEFAULT_SUBSTAT_ROLLS.skillDmgBonus * ECHO_SUBSTAT.skillDmgBonus
}

export function accumulateEchoMainBlock(
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

export function accumulateCost4Mains(
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

export interface SlotBootstrap {
  charId: number
  baseStats: StatTable
  triggerable: BuffDef[]
  permanentInstances: BuffInstance[]
}

/**
 * Resolve a single slot into base stats, triggerable BuffDefs, and permanent
 * sim-start instances (those with a Condition). Pure aside from catalog reads.
 */
export function bootstrapSlot(
  charId: number,
  loadout: SlotLoadout | null,
): SlotBootstrap | null {
  const character = getCharacterById(charId)
  if (!character) return null

  const sequence = loadout?.sequence ?? 0

  const stats: StatTable = {
    ...emptyStatTable(),
    atkBase: character.stats.max.atk,
    hpBase: character.stats.max.hp,
    defBase: character.stats.max.def,
  }

  accumulateEchoSubstatBlock(stats, character)
  accumulateEchoMainBlock(
    stats,
    loadout?.echoBuild ?? "4-3-3-1-1",
    character.primaryScalingStat ?? "atk",
  )
  accumulateCost4Mains(
    stats,
    loadout?.cost4Mains ?? ["cd"],
    character.primaryScalingStat ?? "atk",
  )

  const buffs: BuffDef[] = [...buildCharacterBuffDefs(character, sequence)]

  const weaponId = loadout?.weaponId ?? null
  if (weaponId !== null) {
    const weapon = getWeaponById(weaponId)
    if (weapon) {
      applyWeaponIntrinsic(stats, weapon.stats.main.max, weapon.stats.main.name)
      applyWeaponIntrinsic(stats, weapon.stats.sub.max, weapon.stats.sub.name)
      buffs.push(...buildWeaponBuffDefs(weapon, loadout?.weaponRank ?? 1))
    }
  }

  const echoId = loadout?.echoId ?? null
  if (echoId !== null) {
    const echo = getEchoById(echoId)
    if (echo) buffs.push(...buildEchoBuffDefs(echo))
  }

  buffs.push(
    ...buildEchoSetBuffDefs(
      loadout?.echoSetSlot1Id ?? null,
      loadout?.echoSetSlot2Id ?? null,
    ),
  )

  buffs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const triggerable: BuffDef[] = []
  const permanentInstances: BuffInstance[] = []
  for (const buff of buffs) {
    const isPermanentSimStart =
      buff.trigger.event === "simStart" && buff.duration.kind === "permanent"
    if (isPermanentSimStart && !buff.condition) {
      accumulateStatEffects(stats, { def: buff, stacks: 1 })
    } else if (isPermanentSimStart && buff.condition) {
      permanentInstances.push({
        def: buff,
        sourceCharacterId: charId,
        targetCharacterId: charId,
        endTime: Number.POSITIVE_INFINITY,
        stacks: 1,
        appliedFrame: 0,
        snapshots: freezeSnapshots(buff, 1),
      })
    } else {
      triggerable.push(buff)
    }
  }

  return { charId, baseStats: stats, triggerable, permanentInstances }
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
