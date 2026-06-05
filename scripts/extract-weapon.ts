import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Weapon, WeaponStat, WeaponStats } from "../src/types/weapon.js"

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const BASE_URL = "https://api-v2.encore.moe/api/en"

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
  const pct = str.replace("%", "")
  const decimals = (pct.split(".")[1]?.length ?? 0) + 2
  return Number((parseFloat(pct) / 100).toFixed(decimals))
}

function mapStat(prop: ApiProperty): WeaponStat {
  const isPercentage = prop.GrowthValues[0]?.Value.endsWith("%") ?? false
  const lastGrowth = prop.GrowthValues[prop.GrowthValues.length - 1]
  const maxRaw = lastGrowth.Value

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
  return v.endsWith("%") ? parsePct(v) : parseFloat(v)
}

function mapParams(descParams: ApiDescParam[]): number[][] {
  if (!descParams.length) return []
  const rankCount = descParams[0].ArrayString.length
  return Array.from({ length: rankCount }, (_, rank) =>
    descParams.map((p) => parseParamValue(p.ArrayString[rank])),
  )
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

// --- Markdown reference ---

const WEAPON_TYPE_FILES: Record<string, string> = {
  Sword: "swords",
  Broadblade: "broadblades",
  Pistols: "pistols",
  Gauntlets: "gauntlets",
  Rectifier: "rectifiers",
}

// Level-90 stat value with trailing zeros trimmed but at least one decimal
// place kept, so meaningful precision survives (77.04%) while round values
// still read as decimals (500.0). Percentages keep their trailing "%".
function formatStatValue(prop: ApiProperty): string {
  const raw = prop.GrowthValues[prop.GrowthValues.length - 1].Value
  const isPercentage = raw.endsWith("%")
  const num = parseFloat(raw.replace("%", ""))
  let formatted = num.toString()
  if (!formatted.includes(".")) formatted += ".0"
  return isPercentage ? `${formatted}%` : formatted
}

function transformDescription(desc: string): string {
  const withRanges = desc.replace(
    /<span\b[^>]*class="[^"]*font-bold[^"]*"[^>]*>(.*?)<\/span>/g,
    (_, inner: string) => {
      const parts = inner.split("/").map((p) => p.trim())
      const allEqual = parts.every((p) => p === parts[0])
      return allEqual ? parts[0] : `**${parts.join(" / ")}**`
    },
  )
  return stripHtml(withRanges)
}

function buildSection(data: ApiWeapon): string {
  const [mainProp, subProp] = data.Properties
  const atk = formatStatValue(mainProp)
  const sub = formatStatValue(subProp)
  const description = transformDescription(data.Desc)

  return (
    `## ${data.WeaponName}\n\n` +
    `**${mainProp.Name}:** ${atk}  \n` +
    `**${subProp.Name}:** ${sub}\n\n` +
    `**${data.ResonName}:**\n` +
    `${description}`
  )
}

export async function appendToReference(data: ApiWeapon): Promise<void> {
  const stem = WEAPON_TYPE_FILES[data.WeaponTypeName]
  if (!stem) {
    console.warn(
      `No reference file mapping for weapon type "${data.WeaponTypeName}"; skipping markdown append.`,
    )
    return
  }

  const refPath = path.join(PROJECT_ROOT, "references/weapons", `${stem}.md`)
  const section = buildSection(data)

  let existing: string | null = null
  try {
    existing = await fs.readFile(refPath, "utf8")
  } catch {
    // File doesn't exist yet
  }

  if (existing === null) {
    const title = stem.charAt(0).toUpperCase() + stem.slice(1)
    const header =
      `# ${title}\n\n` +
      `**Weapon Type:** ${data.WeaponTypeName}  \n` +
      `**Rarity/Level:** Level 90\n\n`
    await fs.writeFile(refPath, `${header}${section}\n`)
    console.log(`Created references/weapons/${stem}.md with ${data.WeaponName}`)
    return
  }

  if (
    existing.split("\n").some((line) => line.trim() === `## ${data.WeaponName}`)
  ) {
    console.warn(
      `${data.WeaponName} already present in references/weapons/${stem}.md; skipping.`,
    )
    return
  }

  await fs.writeFile(refPath, `${existing.trimEnd()}\n\n---\n\n${section}\n`)
  console.log(`Appended ${data.WeaponName} to references/weapons/${stem}.md`)
}

// --- Main ---

export async function extractWeapon(id: string): Promise<void> {
  console.log(`Fetching weapon ${id}...`)

  const res = await fetch(`${BASE_URL}/weapon/${id}`)
  if (!res.ok)
    throw new Error(`API responded with ${res.status}: ${res.statusText}`)

  const data: ApiWeapon = await res.json()

  const missing: string[] = []
  if (!data.ItemId) missing.push("ItemId")
  if (!data.WeaponName) missing.push("WeaponName")
  if (!data.Properties.length) missing.push("Properties")
  if (missing.length > 0) {
    console.warn(
      `Warning: missing or empty fields in API response: ${missing.join(", ")}`,
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

  const slug = data.WeaponName.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
  const outputDir = path.join(PROJECT_ROOT, "src/data/weapons/raw")
  const outputPath = path.join(outputDir, `${slug}.json`)

  try {
    await fs.access(outputPath)
    console.warn(`Overwriting existing file for ${data.WeaponName}`)
  } catch {
    // File doesn't exist yet
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(weapon, null, 2))
  console.log(`Written to src/data/weapons/raw/${slug}.json`)

  await appendToReference(data)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const id = process.argv[2]
  if (!id) {
    console.error("Usage: pnpm extract-weapon <weapon-id>")
    process.exit(1)
  }
  extractWeapon(id).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
