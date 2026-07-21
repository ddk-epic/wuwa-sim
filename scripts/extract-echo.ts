import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Echo, EchoSkill } from "../src/types/echo.js"
import type { DamageEntry, SkillType } from "../src/types/character.js"
import type { EchoSet } from "../src/types/echo-set.js"
import { slugify } from "./lib/slugify.js"

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
  return damageList.map((entry) => ({
    type: entry.Type as SkillType,
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

// resolve-echo models only these two tiers; a wrong type silently mis-resolves
// the second set slot, so refuse rather than guess.
export function deriveSetType(name: string, pieces: number[]): EchoSet["type"] {
  const tiers = [...pieces].sort((a, b) => a - b).join(",")
  if (tiers === "2,5") return "two-five"
  if (tiers === "3") return "three-only"
  throw new Error(`Echo set "${name}" has unsupported piece tiers: ${tiers}`)
}

function mapEchoSets(
  fetterGroupDetails: ApiFetterGroupDetail[],
  fetterDetails: Record<string, ApiFetterDetail>,
): EchoSet[] {
  return fetterGroupDetails.map(({ Group: group }) => {
    const effects = fetterDetails[group.FetterGroupName]
    return {
      id: group.Id,
      name: group.FetterGroupName,
      type: deriveSetType(
        group.FetterGroupName,
        group.FetterMap.map((entry) => entry.Key),
      ),
      effects: group.FetterMap.map((entry, i) => ({
        pieces: entry.Key,
        description: stripHtml(effects.EffectDescriptions[i]),
      })),
      buffs: [],
    }
  })
}

// --- Main ---

export async function extractEcho(id: string): Promise<void> {
  console.log(`Fetching echo ${id}...`)

  const res = await fetch(`${BASE_URL}/echo/${id}`)
  if (!res.ok)
    throw new Error(`API responded with ${res.status}: ${res.statusText}`)

  const data: ApiEcho = await res.json()

  const cost = ECHO_COST_MAP[data.Rarity]

  const echoSets = mapEchoSets(data.FetterGroupDetails, data.FetterDetails)

  const echo: Echo = {
    id: data.MonsterId,
    name: data.MonsterName,
    cost: cost,
    element: data.Element.Name as Echo["element"],
    skill: mapSkill(data.Skill),
    sets: echoSets.map((s) => s.name),
    buffs: [],
  }

  const echoSlug = slugify(data.MonsterName)

  const echoDir = path.join(PROJECT_ROOT, "src/data/echoes/raw")
  const setDir = path.join(PROJECT_ROOT, "src/data/echo-sets/raw")

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

  for (const echoSet of echoSets) {
    const setSlug = slugify(echoSet.name)
    const { buffs: _omitBuffs, ...rawSet } = echoSet
    const setPath = path.join(setDir, `${setSlug}.json`)
    try {
      await fs.access(setPath)
      console.log(`Echo set "${echoSet.name}" already exists, skipping.`)
    } catch {
      await fs.writeFile(setPath, JSON.stringify(rawSet, null, 2))
      console.log(`Written to src/data/echo-sets/raw/${setSlug}.json`)
      console.log(
        `Remember to add an entry for "${echoSet.name}" in src/data/echo-sets/index.ts.`,
      )
    }
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
