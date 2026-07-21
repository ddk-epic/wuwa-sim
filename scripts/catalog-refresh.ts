import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import prettier from "prettier"
import type { Element } from "../src/data/elements.js"
import { ELEMENTS } from "../src/data/elements.js"
import type { CharacterEntry, EchoEntry, WeaponEntry } from "./lib/catalog.js"

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const BASE_URL = "https://api-v2.encore.moe/api/en"
const CATALOG_DIR = path.join(PROJECT_ROOT, "scripts/catalog")

// RandGroupId -> echo COST. 5xx is the canonical family; the parallel 2xx family
// is Resonator-signature duplicates and placeholder rows, dropped by omission.
const COST_BY_GROUP: Record<number, number> = { 501: 4, 502: 3, 503: 1 }

// Only 4- and 3-cost echoes occupy the main slot the workflow picks.
const MAIN_SLOT_COSTS = new Set([4, 3])

// Element DMG text is literal; {n} placeholders sit where the numbers would be.
const DMG_ELEMENTS = ELEMENTS.filter((e) => e !== "Physical")

// --- API shapes ---

interface ApiRole {
  Id: number
  Name: string
  QualityId: number
  Element: { Name: string }
  WeaponType: { Name: string }
}

interface ApiWeapon {
  Id: number
  Name: string
  QualityId: number
  TypeName: string
}

interface ApiFetter {
  Key: number
  EffectDescription?: string
}

interface ApiFetterGroup {
  Id: number
  Name: string
  Fetters: ApiFetter[]
}

interface ApiEchoListEntry {
  Id: number
  Name: string
  Type: string
  FetterGroups?: ApiFetterGroup[]
}

// --- Derivation (pure) ---

export function characterCatalog(roleList: ApiRole[]): CharacterEntry[] {
  // Rover ships one id per sex with identical kit; keep the lowest.
  const byName = new Map<string, CharacterEntry>()
  for (const r of roleList) {
    if (r.QualityId !== 5) continue
    const existing = byName.get(r.Name)
    if (existing && existing.id <= r.Id) continue
    byName.set(r.Name, {
      id: r.Id,
      name: r.Name,
      element: r.Element.Name as Element,
      weaponType: r.WeaponType.Name,
    })
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function weaponCatalog(weapons: ApiWeapon[]): WeaponEntry[] {
  return weapons
    .filter((w) => w.QualityId === 5)
    .map((w) => ({ id: w.Id, name: w.Name, weaponType: w.TypeName }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// A set is element-locked if any piece names an element, neutral if none do,
// and joins both lists when it names two.
export function setElements(fetters: ApiFetter[]): Element[] {
  const text = fetters.map((f) => f.EffectDescription ?? "").join(" ")
  return DMG_ELEMENTS.filter((e) => text.includes(e))
}

export function echoCatalog(
  echoList: ApiEchoListEntry[],
  costByEchoId: Map<number, number>,
): EchoEntry[] {
  const out: EchoEntry[] = []
  for (const e of echoList) {
    if (e.Type !== "Echo") continue
    if (e.Name.startsWith("Phantom:")) continue
    const cost = costByEchoId.get(e.Id)
    if (cost === undefined || !MAIN_SLOT_COSTS.has(cost)) continue
    out.push({
      id: e.Id,
      name: e.Name,
      cost,
      sets: (e.FetterGroups ?? []).map((g) => ({
        name: g.Name,
        elements: setElements(g.Fetters),
      })),
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

// --- Fetching (impure) ---

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`${url} responded with ${res.status}: ${res.statusText}`)
  return res.json() as Promise<T>
}

async function echoCostMap(echoIds: number[]): Promise<Map<number, number>> {
  const costs = new Map<number, number>()
  const CONCURRENCY = 12
  for (let i = 0; i < echoIds.length; i += CONCURRENCY) {
    const batch = echoIds.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (id) => {
        const detail = await fetchJson<{ MainProp?: { RandGroupId?: number } }>(
          `${BASE_URL}/echo/${id}`,
        )
        return { id, group: detail.MainProp?.RandGroupId }
      }),
    )
    for (const { id, group } of results) {
      const cost = group === undefined ? undefined : COST_BY_GROUP[group]
      if (cost !== undefined) costs.set(id, cost)
    }
    console.log(
      `  cost: ${Math.min(i + CONCURRENCY, echoIds.length)}/${echoIds.length}`,
    )
  }
  return costs
}

// Format through prettier so the script's output already matches the commit
// hook, otherwise every refresh churns the file on the next commit.
async function writeJson(name: string, value: unknown): Promise<void> {
  const file = path.join(CATALOG_DIR, `${name}.json`)
  const formatted = await prettier.format(JSON.stringify(value), {
    parser: "json",
  })
  await fs.writeFile(file, formatted)
}

async function refresh(): Promise<void> {
  await fs.mkdir(CATALOG_DIR, { recursive: true })

  console.log("Fetching character list...")
  const roles = (
    await fetchJson<{ roleList: ApiRole[] }>(`${BASE_URL}/character`)
  ).roleList

  console.log("Fetching weapon list...")
  const weapons = (
    await fetchJson<{ weapons: ApiWeapon[] }>(`${BASE_URL}/weapon`)
  ).weapons

  console.log("Fetching echo list...")
  const echoes = (
    await fetchJson<{ Echo: ApiEchoListEntry[] }>(`${BASE_URL}/echo`)
  ).Echo

  const echoDetailIds = echoes.filter((e) => e.Type === "Echo").map((e) => e.Id)
  console.log(`Fetching cost for ${echoDetailIds.length} echoes...`)
  const costs = await echoCostMap(echoDetailIds)

  const characters = characterCatalog(roles)
  const weaponEntries = weaponCatalog(weapons)
  const echoEntries = echoCatalog(echoes, costs)

  await writeJson("characters", characters)
  await writeJson("weapons", weaponEntries)
  await writeJson("echoes", echoEntries)
  await writeJson("meta", {
    refreshedAt: new Date().toISOString(),
    counts: {
      characters: characters.length,
      weapons: weaponEntries.length,
      echoes: echoEntries.length,
    },
  })

  console.log(
    `Wrote ${characters.length} characters, ${weaponEntries.length} weapons, ${echoEntries.length} echoes to scripts/catalog/`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  refresh().catch((err: Error) => {
    console.error(err.message)
    process.exit(1)
  })
}
