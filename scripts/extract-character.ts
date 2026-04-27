import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  Character,
  CharacterStats,
  DamageEntry,
  Skill,
  SkillAttribute,
  StatGroup,
} from '../src/types/character.js'

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const BASE_URL = 'https://api-v2.encore.moe/api/en'

// --- API shape ---

interface ApiGrowthValue {
  growthId: number
  level: number
  value: number
}

interface ApiProperty {
  Name: string
  BaseValue: number
  GrowthValues: ApiGrowthValue[]
}

interface ApiSkillAttribute {
  attributeId: number
  attributeName: string
  values: string[]
  Description: string
}

interface ApiDamageEntry {
  EntryNumber: number
  Id: number
  Condition: string
  Type: string
  DmgType?: string
  PropertyName: string
  RateLv: string[]
  Energy: number[]
  ElementPower: number[]
  ToughLv: number[]
  WeaknessLvl: number[]
}

interface ApiSkill {
  SkillId: number
  SkillType: string
  SkillName: string
  SkillAttributes: ApiSkillAttribute[]
  DamageList: ApiDamageEntry[]
}

interface ApiCharacter {
  Id: number
  Name: { Title: string; Content: string }
  ElementName: string
  WeaponType: number
  QualityName: string
  Properties: ApiProperty[]
  Skills: ApiSkill[]
}

// --- Mapping ---

const WEAPON_TYPE_MAP: Record<number, string> = {
  1: 'Broadblade',
  2: 'Sword',
  3: 'Pistols',
  4: 'Gauntlets',
  5: 'Rectifier',
}

const STAT_KEY_MAP: Record<string, keyof StatGroup> = {
  HP: 'hp',
  ATK: 'atk',
  DEF: 'def',
}

function mapStats(properties: ApiProperty[]): CharacterStats {
  const base = {} as StatGroup
  const max = {} as StatGroup

  for (const prop of properties) {
    const key = STAT_KEY_MAP[prop.Name]
    if (!key) continue

    base[key] = prop.BaseValue
    const maxGrowth = prop.GrowthValues[prop.GrowthValues.length - 1]
    max[key] = maxGrowth?.value ?? prop.BaseValue
  }

  return { base, max }
}

function parseValue(rateStr: string): number {
  const pct = rateStr.replace('%', '')
  const decimals = (pct.split('.')[1]?.length ?? 0) + 2
  return Number((parseFloat(pct) / 100).toFixed(decimals))
}

function mapDamageEntries(damageList: ApiDamageEntry[]): DamageEntry[] {
  return (damageList ?? []).map((entry) => ({
    type: entry.Type,
    dmgType: entry.DmgType ?? 'damage',
    scalingStat: entry.PropertyName,
    value: parseValue(entry.RateLv[9]),
    energy: entry.Energy[0],
    concerto: entry.ElementPower[0],
    toughness: entry.ToughLv[0],
    weakness: entry.WeaknessLvl[0],
  }))
}

interface ParsedRate {
  value: number
  count: number
}

function parseValuesFromValue(value: string): ParsedRate[] {
  const results: ParsedRate[] = []
  const regex = /([\d.]+)%(?:\*(\d+))?/g
  let match
  while ((match = regex.exec(value)) !== null) {
    const pct = match[1]
    const count = match[2] ? parseInt(match[2], 10) : 1
    const decimals = (pct.split('.')[1]?.length ?? 0) + 2
    results.push({
      value: Number((parseFloat(pct) / 100).toFixed(decimals)),
      count,
    })
  }
  return results
}

function enrichSkill(
  attributes: ApiSkillAttribute[],
  damageList: ApiDamageEntry[],
): {
  stages: SkillAttribute[]
  damage: DamageEntry[]
  cooldown?: number
  duration?: number
  concerto?: number
  resonanceCost?: number
} {
  const pool = mapDamageEntries(damageList)

  const enrichedAttributes: SkillAttribute[] = (attributes ?? []).map(
    (attr) => {
      const value = attr.values[9] ?? ''
      const parsedRates = parseValuesFromValue(value)

      if (parsedRates.length === 0) {
        return { name: attr.attributeName, value }
      }

      const matched: DamageEntry[] = []
      for (const { value, count } of parsedRates) {
        let consumed = 0
        for (let i = 0; i < pool.length && consumed < count; i++) {
          if (pool[i].value === value) {
            matched.push(...pool.splice(i, 1))
            i--
            consumed++
          }
        }
        if (consumed > 0 && consumed < count) {
          const missing = count - consumed
          console.warn(
            `  [fill] "${attr.attributeName}" expects ${count}× value ${value} but only ${consumed} found — duplicating last entry ${missing} time(s)`,
          )
          for (let i = 0; i < missing; i++) {
            matched.push({ ...matched[matched.length - 1] })
          }
        }
      }

      if (matched.length === 0) {
        return { name: attr.attributeName, value }
      }

      return { name: attr.attributeName, value, damage: matched }
    },
  )

  const STA_COST_SUFFIX = ' STA Cost'
  const COOLDOWN_SUFFIX = ' Cooldown'
  const CONCERTO_SUFFIX = ' Concerto Regen'
  const CONCERTO_ENERGY_SUFFIX = ' Concerto Energy'
  let skillCooldown: number | undefined
  let skillDuration: number | undefined
  let skillConcerto: number | undefined
  let skillResonanceCost: number | undefined

  const finalAttributes = enrichedAttributes.filter((attr) => {
    if (attr.name === 'Cooldown') {
      skillCooldown = parseFloat(attr.value)
      return false
    }
    if (attr.name === 'Concerto Regen') {
      skillConcerto = parseFloat(attr.value)
      return false
    }
    if (attr.name === 'Resonance Cost') {
      skillResonanceCost = parseFloat(attr.value)
      return false
    }
    if (attr.name.endsWith('Duration')) {
      skillDuration = parseFloat(attr.value)
      return false
    }
    if (attr.name.endsWith(STA_COST_SUFFIX)) {
      const keyword = attr.name.slice(0, -STA_COST_SUFFIX.length)
      const target = enrichedAttributes.find(
        (a) => a !== attr && a.name.includes(keyword),
      )
      if (target) target.staCost = parseFloat(attr.value)
      return false
    }
    if (attr.name.endsWith(COOLDOWN_SUFFIX)) {
      const keyword = attr.name.slice(0, -COOLDOWN_SUFFIX.length)
      const target = enrichedAttributes.find(
        (a) => a !== attr && a.name.includes(keyword),
      )
      if (target) target.cooldown = parseFloat(attr.value)
      return false
    }
    if (attr.name.endsWith(CONCERTO_SUFFIX)) {
      const keyword = attr.name.slice(0, -CONCERTO_SUFFIX.length)
      const target = enrichedAttributes.find(
        (a) => a !== attr && a.name.includes(keyword),
      )
      if (target) target.concerto = parseFloat(attr.value)
      return false
    }
    if (attr.name.endsWith(CONCERTO_ENERGY_SUFFIX)) {
      const keyword = attr.name.slice(0, -CONCERTO_ENERGY_SUFFIX.length)
      const target = enrichedAttributes.find(
        (a) => a !== attr && a.name.includes(keyword),
      )
      if (target) target.concerto = parseFloat(attr.value)
      return false
    }
    return true
  })

  const orderedAttributes = finalAttributes.map(
    ({ name, value, staCost, cooldown, concerto, damage }) => ({
      name,
      value,
      ...(staCost !== undefined && { staCost }),
      ...(cooldown !== undefined && { cooldown }),
      ...(concerto !== undefined && { concerto }),
      ...(damage !== undefined && { damage }),
    }),
  )

  return {
    stages: orderedAttributes,
    damage: pool,
    cooldown: skillCooldown,
    duration: skillDuration,
    concerto: skillConcerto,
    resonanceCost: skillResonanceCost,
  }
}

function mapSkills(skills: ApiSkill[]): Skill[] {
  return (skills ?? []).map((skill) => {
    const { stages, damage, cooldown, duration, concerto, resonanceCost } =
      enrichSkill(skill.SkillAttributes, skill.DamageList)
    return {
      id: skill.SkillId,
      name: skill.SkillName,
      type: skill.SkillType,
      ...(cooldown !== undefined && { cooldown }),
      ...(duration !== undefined && { duration }),
      ...(concerto !== undefined && { concerto }),
      ...(resonanceCost !== undefined && { resonanceCost }),
      stages,
      damage,
    }
  })
}

// --- Main ---

export async function extractCharacter(id: string): Promise<void> {
  console.log(`Fetching character ${id}...`)

  const res = await fetch(`${BASE_URL}/character/${id}`)
  if (!res.ok)
    throw new Error(`API responded with ${res.status}: ${res.statusText}`)

  const data: ApiCharacter = await res.json()

  const missing: string[] = []
  if (!data.Id) missing.push('Id')
  if (!data.Name?.Content) missing.push('Name.Content')
  if (!data.Skills?.length) missing.push('Skills')
  if (!data.Properties?.length) missing.push('Properties')
  if (missing.length > 0) {
    console.warn(
      `Warning: missing or empty fields in API response: ${missing.join(', ')}`,
    )
  }

  const weaponType = WEAPON_TYPE_MAP[data.WeaponType]
  if (!weaponType) {
    console.warn(
      `Warning: unknown WeaponType ${data.WeaponType}, using raw value`,
    )
  }

  const character: Character = {
    id: data.Id,
    name: data.Name.Content,
    element: data.ElementName,
    weaponType: weaponType ?? String(data.WeaponType),
    rarity: data.QualityName,
    stats: mapStats(data.Properties),
    skills: mapSkills(data.Skills),
  }

  const slug = data.Name.Content.toLowerCase().replace(/\s+/g, '-')
  const outputDir = path.join(PROJECT_ROOT, 'src/data/characters')
  const outputPath = path.join(outputDir, `${slug}.json`)

  try {
    await fs.access(outputPath)
    console.warn(`Overwriting existing file for ${data.Name.Content}`)
  } catch {
    // File doesn't exist yet
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(character, null, 2))
  console.log(`Written to src/data/characters/${slug}.json`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const id = process.argv[2]
  if (!id) {
    console.error('Usage: pnpm extract-character <character-id>')
    process.exit(1)
  }
  extractCharacter(id).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
