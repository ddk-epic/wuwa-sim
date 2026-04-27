export interface StatGroup {
  hp: number
  atk: number
  def: number
}

export interface CharacterStats {
  base: StatGroup
  max: StatGroup
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
  toughness: number
  weakness: number
  hardness?: number
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
  weaponType: string
  rarity: string
  stats: CharacterStats
  skills: Skill[]
}
