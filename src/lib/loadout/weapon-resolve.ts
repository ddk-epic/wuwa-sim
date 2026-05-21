import type { BuffDef, ValueExpr } from "#/types/buff"
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
  if (!Array.isArray(value.v)) return value as ValueExpr
  if (value.v.length !== 5) {
    throw new Error(
      `Weapon value array must have exactly 5 entries, got ${value.v.length}`,
    )
  }
  return { kind: value.kind, v: value.v[rank - 1] }
}
