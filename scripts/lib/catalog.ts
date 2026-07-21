import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Element } from "../../src/data/elements.js"

export const CATALOG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "catalog",
)

export interface CharacterEntry {
  id: number
  name: string
  element: Element
  weaponType: string
}

export interface WeaponEntry {
  id: number
  name: string
  weaponType: string
}

export interface EchoSetRef {
  name: string
  elements: Element[]
}

export interface EchoEntry {
  id: number
  name: string
  cost: number
  sets: EchoSetRef[]
}

export interface CatalogMeta {
  refreshedAt: string
  counts: { characters: number; weapons: number; echoes: number }
}

export interface Catalog {
  characters: CharacterEntry[]
  weapons: WeaponEntry[]
  echoes: EchoEntry[]
  meta: CatalogMeta
}

async function readJson<T>(name: string): Promise<T> {
  const file = path.join(CATALOG_DIR, `${name}.json`)
  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as T
  } catch {
    throw new Error(
      `Catalog file ${name}.json is missing. Run: pnpm catalog:refresh`,
    )
  }
}

export async function loadCatalog(): Promise<Catalog> {
  const [characters, weapons, echoes, meta] = await Promise.all([
    readJson<CharacterEntry[]>("characters"),
    readJson<WeaponEntry[]>("weapons"),
    readJson<EchoEntry[]>("echoes"),
    readJson<CatalogMeta>("meta"),
  ])
  return { characters, weapons, echoes, meta }
}

export function catalogAgeDays(meta: CatalogMeta, now = new Date()): number {
  const ms = now.getTime() - new Date(meta.refreshedAt).getTime()
  return ms / (1000 * 60 * 60 * 24)
}
