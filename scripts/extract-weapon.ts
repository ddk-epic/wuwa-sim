import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Weapon, WeaponStat, WeaponStats } from '../src/types/weapon.js'

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const BASE_URL = 'https://api-v2.encore.moe/api/en'

// --- API shape ---

interface ApiGrowthValue {
  Level: number
  Value: string
}

interface ApiProperty {
  Name: string
  BaseValue: number
  GrowthValues: ApiGrowthValue[]
}

interface ApiDescParam {
  ArrayString: string[]
}

interface ApiWeapon {
  ItemId: number
  WeaponName: string
  QualityName: string
  WeaponTypeName: string
  ResonName: string
  Desc: string
  Properties: ApiProperty[]
  DescParams: ApiDescParam[]
}

// --- Mapping ---

function parsePct(str: string): number {
  const pct = str.replace('%', '')
  const decimals = (pct.split('.')[1]?.length ?? 0) + 2
  return Number((parseFloat(pct) / 100).toFixed(decimals))
}

function mapStat(prop: ApiProperty): WeaponStat {
  const isPercentage = prop.GrowthValues[0]?.Value.endsWith('%') ?? false
  const lastGrowth = prop.GrowthValues[prop.GrowthValues.length - 1]
  const maxRaw = lastGrowth?.Value ?? String(prop.BaseValue)

  const base = isPercentage ? prop.BaseValue / 10000 : prop.BaseValue
  const max = isPercentage ? parsePct(maxRaw) : parseFloat(maxRaw)

  return { name: prop.Name, base, max }
}

function mapStats(properties: ApiProperty[]): WeaponStats {
  const [mainProp, subProp] = properties
  return {
    main: mapStat(mainProp),
    sub: mapStat(subProp),
  }
}

function parseParamValue(v: string): number {
  return v.endsWith('%') ? parsePct(v) : parseFloat(v)
}

function mapParams(descParams: ApiDescParam[]): number[][] {
  if (!descParams?.length) return []
  const rankCount = descParams[0].ArrayString.length
  return Array.from({ length: rankCount }, (_, rank) =>
    descParams.map((p) => parseParamValue(p.ArrayString[rank])),
  )
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

// --- Main ---

async function extractWeapon(id: string): Promise<void> {
  console.log(`Fetching weapon ${id}...`)

  const res = await fetch(`${BASE_URL}/weapon/${id}`)
  if (!res.ok)
    throw new Error(`API responded with ${res.status}: ${res.statusText}`)

  const data: ApiWeapon = await res.json()

  const missing: string[] = []
  if (!data.ItemId) missing.push('ItemId')
  if (!data.WeaponName) missing.push('WeaponName')
  if (!data.Properties?.length) missing.push('Properties')
  if (missing.length > 0) {
    console.warn(
      `Warning: missing or empty fields in API response: ${missing.join(', ')}`,
    )
  }

  const weapon: Weapon = {
    id: data.ItemId,
    name: data.WeaponName,
    rarity: data.QualityName,
    weaponType: data.WeaponTypeName,
    stats: mapStats(data.Properties),
    passive: {
      name: data.ResonName,
      description: stripHtml(data.Desc),
      params: mapParams(data.DescParams),
    },
  }

  const slug = data.WeaponName.toLowerCase().replace(/\s+/g, '-')
  const outputDir = path.join(PROJECT_ROOT, 'src/data/weapons')
  const outputPath = path.join(outputDir, `${slug}.json`)

  try {
    await fs.access(outputPath)
    console.warn(`Overwriting existing file for ${data.WeaponName}`)
  } catch {
    // File doesn't exist yet
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(weapon, null, 2))
  console.log(`Written to src/data/weapons/${slug}.json`)
}

const id = process.argv[2]
if (!id) {
  console.error('Usage: pnpm extract-weapon <weapon-id>')
  process.exit(1)
}

extractWeapon(id).catch((err) => {
  console.error(err.message)
  process.exit(1)
})
