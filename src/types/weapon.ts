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

export interface EnrichedWeapon {
  id: number
  name: string
  weaponType: string
  stats: EnrichedWeaponStats
  passive: { name: string }
}
