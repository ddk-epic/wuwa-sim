export interface StatValue {
  base: number
  max: number
}

export interface CharacterStats {
  hp: StatValue
  atk: StatValue
  def: StatValue
  critRate: StatValue
  critDmg: StatValue
}

export interface SkillAttribute {
  name: string
  value: string
  damage?: DamageEntry[]
}

export interface DamageEntry {
  type: string
  dmgType: string
  scalingStat: string
  rate: number
  energy: number
  elementPower: number
  toughLv: number
  weaknessLv: number
}

export interface Skill {
  id: number
  type: string
  name: string
  attributes: SkillAttribute[]
  damage: DamageEntry[]
}

export interface Character {
  id: number
  name: string
  element: string
  weaponType: number
  rarity: string
  stats: CharacterStats
  skills: Skill[]
}
