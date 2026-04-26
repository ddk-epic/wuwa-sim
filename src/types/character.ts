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
  staCost?: number
  cooldown?: number
  concerto?: number
  damage?: DamageEntry[]
}

export interface DamageEntry {
  type: string
  dmgType: string
  scalingStat: string
  value: number
  energy: number
  concerto: number
  toughLv: number
  weaknessLv: number
}

export interface Skill {
  id: number
  name: string
  type: string
  cooldown?: number
  duration?: number
  concerto?: number
  stages: SkillAttribute[]
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
