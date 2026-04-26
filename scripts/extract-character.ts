import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  Character,
  CharacterStats,
  DamageEntry,
  Skill,
  SkillAttribute,
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

const STAT_KEY_MAP: Record<string, keyof CharacterStats> = {
  HP: 'hp',
  ATK: 'atk',
  DEF: 'def',
  'Crit. Rate': 'critRate',
  'Crit. DMG': 'critDmg',
}

const PERCENTAGE_STATS = new Set(['Crit. Rate', 'Crit. DMG'])

function mapStats(properties: ApiProperty[]): CharacterStats {
  const stats = {} as CharacterStats

  for (const prop of properties) {
    const key = STAT_KEY_MAP[prop.Name]
    if (!key) continue

    const maxGrowth = prop.GrowthValues[prop.GrowthValues.length - 1]
    const maxRaw = maxGrowth?.value ?? prop.BaseValue
    const divisor = PERCENTAGE_STATS.has(prop.Name) ? 10000 : 1

    stats[key] = {
      base: prop.BaseValue / divisor,
      max: maxRaw / divisor,
    }
  }

  return stats
}

function parseRate(rateStr: string): number {
  const pct = rateStr.replace('%', '')
  const decimals = (pct.split('.')[1]?.length ?? 0) + 2
  return Number((parseFloat(pct) / 100).toFixed(decimals))
}

function mapDamageEntries(damageList: ApiDamageEntry[]): DamageEntry[] {
  return (damageList ?? []).map((entry) => ({
    type: entry.Type,
    dmgType: entry.DmgType ?? 'damage',
    scalingStat: entry.PropertyName,
    rate: parseRate(entry.RateLv[9]),
    energy: entry.Energy[0],
    elementPower: entry.ElementPower[0],
    toughLv: entry.ToughLv[0],
    weaknessLv: entry.WeaknessLvl[0],
  }))
}

function mapSkillAttributes(attributes: ApiSkillAttribute[]): SkillAttribute[] {
  return (attributes ?? []).map((attr) => ({
    name: attr.attributeName,
    value: attr.values[9] ?? '',
  }))
}

function mapSkills(skills: ApiSkill[]): Skill[] {
  return (skills ?? []).map((skill) => ({
    id: skill.SkillId,
    type: skill.SkillType,
    name: skill.SkillName,
    attributes: mapSkillAttributes(skill.SkillAttributes),
    damage: mapDamageEntries(skill.DamageList),
  }))
}

// --- Main ---

async function extractCharacter(id: string): Promise<void> {
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

  const character: Character = {
    id: data.Id,
    name: data.Name.Content,
    element: data.ElementName,
    weaponType: data.WeaponType,
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

const id = process.argv[2]
if (!id) {
  console.error('Usage: pnpm extract <character-id>')
  process.exit(1)
}

extractCharacter(id).catch((err) => {
  console.error(err.message)
  process.exit(1)
})
