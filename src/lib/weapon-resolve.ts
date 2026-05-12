import type { BuffDef, Effect, ValueExpr } from "#/types/buff"

export interface WeaponBuffSpec {
  buffs: BuffDef[]
}

export function resolveWeaponBuffs(
  weapon: WeaponBuffSpec,
  rank: number,
): BuffDef[] {
  if (rank < 1 || rank > 5) {
    throw new Error(`Weapon rank must be 1–5, got ${rank}`)
  }
  return weapon.buffs.map((buff) => ({
    ...buff,
    effects: buff.effects.map((effect) => resolveEffect(effect, rank)),
  }))
}

function resolveEffect(effect: Effect, rank: number): Effect {
  if (effect.kind !== "stat") return effect
  return { ...effect, value: resolveValue(effect.value, rank) }
}

function resolveValue(value: ValueExpr, rank: number): ValueExpr {
  if (value.kind !== "byRank" && value.kind !== "byRankPerStack") return value
  if (value.values.length !== 5) {
    throw new Error(
      `${value.kind} values array must have exactly 5 entries, got ${value.values.length}`,
    )
  }
  if (value.kind === "byRankPerStack") {
    return { kind: "perStack", v: value.values[rank - 1] }
  }
  return { kind: "const", v: value.values[rank - 1] }
}
