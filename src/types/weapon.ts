import type { BuffDef, Effect, StatEffect } from "./buff"

/** Value expression used in weapon buff authoring. `v` may be a rank-indexed array of 5 numbers. */
export type WeaponValueExpr =
  | { kind: "const"; v: number | number[]; snapshot?: boolean }
  | { kind: "perStack"; v: number | number[]; snapshot?: boolean }

export type WeaponStatEffect = Omit<StatEffect, "value"> & {
  value: WeaponValueExpr
}
export type WeaponEffect = WeaponStatEffect | Exclude<Effect, StatEffect>
export type WeaponBuff = Omit<BuffDef, "effects"> & { effects: WeaponEffect[] }

export interface WeaponStat {
  name: string
  base: number
  max: number
}

export interface WeaponStats {
  main: WeaponStat
  sub: WeaponStat
}

export interface WeaponPassive {
  name: string
  description: string
  params: number[][]
}

export interface Weapon {
  id: number
  name: string
  rarity: string
  weaponType: string
  stats: WeaponStats
  passive: WeaponPassive
}

export interface EnrichedWeaponStat {
  name: string
  base: number
  max: number
}

export interface EnrichedWeaponStats {
  main: EnrichedWeaponStat
  sub: EnrichedWeaponStat
}

export interface WeaponData {
  id: number
  name: string
  weaponType: string
  stats: EnrichedWeaponStats
  passive: { name: string }
  buffs: WeaponBuff[]
}

/** @deprecated Use WeaponData */
export type EnrichedWeapon = WeaponData
