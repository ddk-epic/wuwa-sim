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
}

export interface Skill {
  id: number
  name: string
  type: string
  cooldown?: number
  duration?: number
  concerto?: number
  resonanceCost?: number
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

export type EnrichedSkillAttribute = Omit<SkillAttribute, 'staCost'> & {
  actionTime: number
}

export interface EnrichedSkill extends Omit<Skill, 'stages'> {
  stages: EnrichedSkillAttribute[]
  animationLock?: number
  hidden?: boolean
}

export type SkillMetadata = Partial<Omit<EnrichedSkill, 'id' | 'stages'>> & {
  stageOverrides?: Record<string, Partial<EnrichedSkillAttribute>>
}

export interface EnrichedCharacter extends Omit<Character, 'skills'> {
  skills: EnrichedSkill[]
}
