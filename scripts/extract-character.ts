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

interface ParsedRate {
  rate: number
  count: number
}

function parseRatesFromValue(value: string): ParsedRate[] {
  const results: ParsedRate[] = []
  const regex = /([\d.]+)%(?:\*(\d+))?/g
  let match
  while ((match = regex.exec(value)) !== null) {
    const pct = match[1]
    const count = match[2] ? parseInt(match[2], 10) : 1
    const decimals = (pct.split('.')[1]?.length ?? 0) + 2
    results.push({
      rate: Number((parseFloat(pct) / 100).toFixed(decimals)),
      count,
    })
  }
  return results
}

function enrichSkill(
  attributes: ApiSkillAttribute[],
  damageList: ApiDamageEntry[],
): { attributes: SkillAttribute[]; damage: DamageEntry[]; cooldown?: number } {
  const pool = mapDamageEntries(damageList)

  const enrichedAttributes: SkillAttribute[] = (attributes ?? []).map(
    (attr) => {
      const value = attr.values[9] ?? ''
      const parsedRates = parseRatesFromValue(value)

      if (parsedRates.length === 0) {
        return { name: attr.attributeName, value }
      }

      const matched: DamageEntry[] = []
      for (const { rate, count } of parsedRates) {
        let consumed = 0
        for (let i = 0; i < pool.length && consumed < count; i++) {
          if (pool[i].rate === rate) {
            matched.push(...pool.splice(i, 1))
            i--
            consumed++
          }
        }
        if (consumed > 0 && consumed < count) {
          const missing = count - consumed
          console.warn(
            `  [fill] "${attr.attributeName}" expects ${count}× rate ${rate} but only ${consumed} found — duplicating last entry ${missing} time(s)`,
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
  let skillCooldown: number | undefined

  const finalAttributes = enrichedAttributes.filter((attr) => {
    if (attr.name === 'Cooldown') {
      skillCooldown = parseFloat(attr.value)
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
    return true
  })

  const orderedAttributes = finalAttributes.map(
    ({ name, value, staCost, cooldown, damage }) => ({
      name,
      value,
      ...(staCost !== undefined && { staCost }),
      ...(cooldown !== undefined && { cooldown }),
      ...(damage !== undefined && { damage }),
    }),
  )

  return {
    attributes: orderedAttributes,
    damage: pool,
    cooldown: skillCooldown,
  }
}

function mapSkills(skills: ApiSkill[]): Skill[] {
  return (skills ?? []).map((skill) => {
    const { attributes, damage, cooldown } = enrichSkill(
      skill.SkillAttributes,
      skill.DamageList,
    )
    return {
      id: skill.SkillId,
      type: skill.SkillType,
      name: skill.SkillName,
      ...(cooldown !== undefined && { cooldown }),
      attributes,
      damage,
    }
  })
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
