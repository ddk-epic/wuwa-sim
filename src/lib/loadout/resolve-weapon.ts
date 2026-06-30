import type { BuffDef, ValueExpr } from "#/types/buff"
import type { StatTable } from "#/types/stat-table"
import type { WeaponData, WeaponValueExpr } from "#/types/weapon"

export function resolveWeaponBuffs(
  weapon: WeaponData,
  rank: number,
): BuffDef[] {
  if (rank < 1 || rank > 5) {
    throw new Error(`Weapon rank must be 1–5, got ${rank}`)
  }
  return weapon.buffs.map((buff) => ({
    ...buff,
    effects: buff.effects.map((effect) => {
      if (effect.kind === "stat" || effect.kind === "resource") {
        return { ...effect, value: resolveValue(effect.value, rank) }
      }
      return effect
    }),
  }))
}

function resolveValue(value: WeaponValueExpr, rank: number): ValueExpr {
  if (!Array.isArray(value.v)) {
    return { kind: value.kind, v: value.v, snapshot: value.snapshot }
  }
  if (value.v.length !== 5) {
    throw new Error(
      `Weapon value array must have exactly 5 entries, got ${value.v.length}`,
    )
  }
  return { kind: value.kind, v: value.v[rank - 1] }
}

export function resolveWeaponStats(stats: StatTable, weapon: WeaponData): void {
  applyWeaponIntrinsic(stats, weapon.stats.main.max, weapon.stats.main.name)
  applyWeaponIntrinsic(stats, weapon.stats.sub.max, weapon.stats.sub.name)
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
