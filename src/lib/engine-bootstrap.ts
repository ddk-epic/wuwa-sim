import type { BuffDef, BuffInstance, StatPath } from "#/types/buff"
import type { SlotLoadout } from "#/types/loadout"
import type { StatTable } from "#/types/stat-table"
import { emptyStatTable } from "#/types/stat-table"
import {
  getCharacterById,
  getEchoById,
  getEchoSetById,
  getWeaponById,
} from "./catalog"
import { accumulateStatEffects, freezeSnapshots } from "./stat-table-builder"

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
  pieces: number,
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

  const buffs: BuffDef[] = []

  for (const def of character.buffs) {
    if ((def.requiresSequence ?? 0) <= sequence) buffs.push(def)
  }

  for (const nodeName of character.skillTreeBonuses) {
    const def = compileSkillTreeNode(nodeName, {
      characterId: character.id,
      characterElement: character.element,
    })
    if (def) buffs.push(def)
  }

  const weaponId = loadout?.weaponId ?? null
  if (weaponId !== null) {
    const weapon = getWeaponById(weaponId)
    if (weapon) {
      applyWeaponIntrinsic(stats, weapon.stats.main.max, weapon.stats.main.name)
      applyWeaponIntrinsic(stats, weapon.stats.sub.max, weapon.stats.sub.name)
      buffs.push(...weapon.buffs)
    }
  }

  const echoId = loadout?.echoId ?? null
  if (echoId !== null) {
    const echo = getEchoById(echoId)
    if (echo) buffs.push(...echo.buffs)
  }

  const echoSetId = loadout?.echoSetId ?? null
  if (echoSetId !== null) {
    const echoSet = getEchoSetById(echoSetId)
    if (echoSet) {
      for (const def of echoSet.buffs) {
        if ((def.requiresPieces ?? 2) <= pieces) buffs.push(def)
      }
    }
  }

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
  }
}
