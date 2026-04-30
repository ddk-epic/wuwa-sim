import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Echo, EchoSkill } from "../src/types/echo.js"
import type { DamageEntry } from "../src/types/character.js"
import type { EchoSet } from "../src/types/echo-set.js"

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const BASE_URL = "https://api-v2.encore.moe/api/en"

// --- API shape ---

interface ApiDamageEntry {
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
  SkillCD: number
  DescriptionEx: string
  DamageList: ApiDamageEntry[]
}

interface ApiFetterMapEntry {
  Key: number
  Value: number
}

interface ApiFetterGroup {
  Id: number
  FetterGroupName: string
  FetterMap: ApiFetterMapEntry[]
}

interface ApiFetterGroupDetail {
  Group: ApiFetterGroup
}

interface ApiFetterDetail {
  EffectDescriptions: string[]
}

interface ApiEcho {
  MonsterId: number
  MonsterName: string
  Rarity: number
  Element: { Name: string }
  Skill: ApiSkill
  FetterGroupDetails: ApiFetterGroupDetail[]
  FetterDetails: Record<string, ApiFetterDetail>
}

// --- Mapping ---

const ECHO_COST_MAP: Record<number, number> = {
  0: 1,
  1: 3,
  2: 4,
}

function parseRateLv(rateStr: string): number {
  const pct = rateStr.replace("%", "")
  const decimals = (pct.split(".")[1]?.length ?? 0) + 2
  return Number((parseFloat(pct) / 100).toFixed(decimals))
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

function mapDamageEntries(damageList: ApiDamageEntry[]): DamageEntry[] {
  return (damageList ?? []).map((entry) => ({
    type: entry.Type,
    dmgType: entry.DmgType ?? "damage",
    scalingStat: entry.PropertyName,
    actionFrame: 0,
    value: parseRateLv(entry.RateLv[4]),
    energy: entry.Energy[0],
    concerto: entry.ElementPower[0],
    toughness: entry.ToughLv[0],
    weakness: entry.WeaknessLvl[0],
  }))
}

function mapSkill(skill: ApiSkill): EchoSkill {
  return {
    cooldown: skill.SkillCD,
    description: stripHtml(skill.DescriptionEx),
    hits: mapDamageEntries(skill.DamageList),
  }
}

function mapEchoSet(
  fetterGroupDetails: ApiFetterGroupDetail[],
  fetterDetails: Record<string, ApiFetterDetail>,
): EchoSet {
  const group = fetterGroupDetails[0].Group
  const effects = fetterDetails[group.FetterGroupName]

  return {
    id: group.Id,
    name: group.FetterGroupName,
    effects: group.FetterMap.map((entry, i) => ({
      pieces: entry.Key,
      description: stripHtml(effects.EffectDescriptions[i]),
    })),
  }
}

// --- Main ---

export async function extractEcho(id: string): Promise<void> {
  console.log(`Fetching echo ${id}...`)

  const res = await fetch(`${BASE_URL}/echo/${id}`)
  if (!res.ok)
    throw new Error(`API responded with ${res.status}: ${res.statusText}`)

  const data: ApiEcho = await res.json()

  const missing: string[] = []
  if (!data.MonsterId) missing.push("MonsterId")
  if (!data.MonsterName) missing.push("MonsterName")
  if (!data.Skill) missing.push("Skill")
  if (!data.FetterGroupDetails?.length) missing.push("FetterGroupDetails")
  if (missing.length > 0) {
    console.warn(
      `Warning: missing or empty fields in API response: ${missing.join(", ")}`,
    )
  }

  const cost = ECHO_COST_MAP[data.Rarity]
  if (cost === undefined) {
    console.warn(`Warning: unknown Rarity ${data.Rarity}, defaulting cost to 1`)
  }

  const echoSet = mapEchoSet(data.FetterGroupDetails, data.FetterDetails)

  const echo: Echo = {
    id: data.MonsterId,
    name: data.MonsterName,
    cost: cost ?? 1,
    element: data.Element.Name,
    skill: mapSkill(data.Skill),
    set: echoSet.name,
  }

  const echoSlug = data.MonsterName.toLowerCase().replace(/\s+/g, "-")
  const setSlug = echoSet.name.toLowerCase().replace(/\s+/g, "-")

  const echoDir = path.join(PROJECT_ROOT, "src/data/echoes/raw")
  const setDir = path.join(PROJECT_ROOT, "src/data/echo-sets")

  await fs.mkdir(echoDir, { recursive: true })
  await fs.mkdir(setDir, { recursive: true })

  const echoPath = path.join(echoDir, `${echoSlug}.json`)
  try {
    await fs.access(echoPath)
    console.warn(`Overwriting existing file for ${data.MonsterName}`)
  } catch {
    // File doesn't exist yet
  }
  await fs.writeFile(echoPath, JSON.stringify(echo, null, 2))
  console.log(`Written to src/data/echoes/raw/${echoSlug}.json`)

  const setPath = path.join(setDir, `${setSlug}.json`)
  try {
    await fs.access(setPath)
    console.log(`Echo set "${echoSet.name}" already exists, skipping.`)
  } catch {
    await fs.writeFile(setPath, JSON.stringify(echoSet, null, 2))
    console.log(`Written to src/data/echo-sets/${setSlug}.json`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const id = process.argv[2]
  if (!id) {
    console.error("Usage: pnpm extract-echo <echo-id>")
    process.exit(1)
  }
  extractEcho(id).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
