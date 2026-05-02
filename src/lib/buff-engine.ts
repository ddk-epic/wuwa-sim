import type { BuffDef, StatEffect, StatPath } from "#/types/buff"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { StatTable } from "#/types/stat-table"
import { emptyStatTable } from "#/types/stat-table"
import {
  getCharacterById,
  getEchoById,
  getEchoSetById,
  getWeaponById,
} from "./catalog"
import { compileSkillTreeNode } from "./skill-tree-registry"

export interface BootstrapInput {
  slots: Slots
  loadouts: SlotLoadout[]
  /** Per-slot resonance chain sequence (0..6). Defaults to 6 for each slot. */
  sequences?: (number | undefined)[]
  /** Per-slot equipped echo set piece count (0, 2, or 5). Defaults to 5. */
  echoSetPieces?: (number | undefined)[]
}

export class BuffEngine {
  private baseStats = new Map<number, StatTable>()

  bootstrap(input: BootstrapInput): void {
    this.baseStats.clear()
    for (let i = 0; i < input.slots.length; i++) {
      const charId = input.slots[i]
      if (charId === null) continue
      const character = getCharacterById(charId)
      if (!character) continue

      const sequence = input.sequences?.[i] ?? 6
      const pieces = input.echoSetPieces?.[i] ?? 5
      const loadout = input.loadouts[i] ?? null

      const stats: StatTable = {
        ...emptyStatTable(),
        atkBase: character.stats.max.atk,
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
          applyWeaponIntrinsic(
            stats,
            weapon.stats.main.max,
            weapon.stats.main.name,
          )
          applyWeaponIntrinsic(
            stats,
            weapon.stats.sub.max,
            weapon.stats.sub.name,
          )
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

      for (const buff of buffs) {
        if (buff.trigger.event !== "simStart") continue
        if (buff.duration.kind !== "permanent") continue
        for (const effect of buff.effects) {
          if (effect.kind !== "stat") continue
          applyStatEffect(stats, effect)
        }
      }

      this.baseStats.set(charId, stats)
    }
  }

  resolveStats(characterId: number): StatTable {
    const cached = this.baseStats.get(characterId)
    if (cached) return cached
    const character = getCharacterById(characterId)
    if (!character) return emptyStatTable()
    return { ...emptyStatTable(), atkBase: character.stats.max.atk }
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
  }
}

function applyStatEffect(stats: StatTable, effect: StatEffect): void {
  if (effect.value.kind !== "const") return
  const v = effect.value.v
  applyToPath(stats, effect.path, v)
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
