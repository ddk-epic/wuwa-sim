import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Element } from "../src/data/elements.js"
import type { Character } from "../src/types/character.js"
import type { Echo } from "../src/types/echo.js"
import type { EchoSet } from "../src/types/echo-set.js"
import type { Weapon } from "../src/types/weapon.js"
import { extractCharacter } from "./extract-character.js"
import { extractEcho } from "./extract-echo.js"
import { extractWeapon } from "./extract-weapon.js"
import { formatCharacter } from "./generate-character.js"
import { formatEcho } from "./generate-echo.js"
import { formatEchoSet } from "./generate-echo-set.js"
import { formatWeapon } from "./generate-weapon.js"
import type { CharacterEntry, EchoEntry, WeaponEntry } from "./lib/catalog.js"
import { catalogAgeDays, loadCatalog } from "./lib/catalog.js"
import type { Choice } from "./lib/prompt.js"
import { select } from "./lib/prompt.js"
import { slugify, toVarName } from "./lib/slugify.js"

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const DATA_DIR = path.join(PROJECT_ROOT, "src/data")
const STALE_DAYS = 30

export interface Template {
  weapon: string
  echo: string
  echoSet: string
}

// --- Selection (pure) ---

export function matchCharacters(
  characters: CharacterEntry[],
  fragment: string,
): CharacterEntry[] {
  const q = fragment.trim().toLowerCase()
  if (!q) return characters
  return characters.filter((c) => c.name.toLowerCase().includes(q))
}

export type EchoTier = "locked" | "cost4" | "cost3"

export function echoesForTier(
  echoes: EchoEntry[],
  element: Element,
  tier: EchoTier,
): EchoEntry[] {
  if (tier === "cost3") return echoes.filter((e) => e.cost === 3)
  const cost4 = echoes.filter((e) => e.cost === 4)
  if (tier === "cost4") return cost4
  return cost4.filter((e) => e.sets.some((s) => s.elements.includes(element)))
}

// --- Index wiring (pure) ---

// Idempotent: adds the import and array entry only if the binding is absent, so
// a re-run over an already-wired index is a no-op.
export function wireIntoIndex(
  source: string,
  varName: string,
  importPath: string,
  arrayName: string,
): string {
  let out = source
  const importRe = new RegExp(`\\bimport\\s*\\{[^}]*\\b${varName}\\b`)
  if (!importRe.test(out)) {
    const lines = out.split("\n")
    let lastImport = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImport = i
    }
    lines.splice(
      lastImport + 1,
      0,
      `import { ${varName} } from "${importPath}"`,
    )
    out = lines.join("\n")
  }

  const arrayRe = new RegExp(
    `(export const ${arrayName}\\b[^=]*=\\s*\\[)([\\s\\S]*?)(\\n\\])`,
  )
  const match = out.match(arrayRe)
  if (!match) throw new Error(`Array ${arrayName} not found in index`)
  if (!new RegExp(`\\b${varName}\\b`).test(match[2])) {
    out = out.replace(arrayRe, `$1$2\n  ${varName},$3`)
  }
  return out
}

// --- Template patch (pure) ---

export function patchTemplate(source: string, template: Template): string {
  const blockRe = /template:\s*\{[^}]*\}/g
  const matches = source.match(blockRe)
  if (!matches || matches.length !== 1) {
    throw new Error(
      `Expected exactly one template block, found ${matches?.length ?? 0}`,
    )
  }
  const block = [
    "template: {",
    `    weapon: ${JSON.stringify(template.weapon)},`,
    `    echo: ${JSON.stringify(template.echo)},`,
    `    echoSet: ${JSON.stringify(template.echoSet)},`,
    "  }",
  ].join("\n")
  return source.replace(blockRe, block)
}

// --- Outstanding-work scan (pure) ---

// Placeholders the generator leaves for a human to author.
export function characterPlaceholders(source: string): string[] {
  const items: string[] = []
  if (/\bforteCap: 100\b/.test(source)) items.push("forteCap is 100 (default)")
  if (/\bmaxEnergy: 0\b/.test(source)) {
    items.push("maxEnergy is 0 (no liberation cost found)")
  }
  if (/\n {2}buffs: \[\],/.test(source)) items.push("no buffs authored")
  const stages = source.match(/actionTime: 0,/g)?.length ?? 0
  if (stages > 0) items.push(`${stages} stages with actionTime: 0`)
  return items
}

export function hasEmptyBuffs(source: string): boolean {
  return /\n {2}buffs: \[\],/.test(source)
}

// --- File helpers (impure) ---

type WriteResult = "created" | "reused"

async function writeIfAbsent(
  file: string,
  content: string,
): Promise<WriteResult> {
  try {
    await fs.access(file)
    return "reused"
  } catch {
    await fs.writeFile(file, content)
    return "created"
  }
}

async function readRaw<T>(dir: string, slug: string): Promise<T> {
  const file = path.join(DATA_DIR, dir, "raw", `${slug}.json`)
  return JSON.parse(await fs.readFile(file, "utf-8")) as T
}

async function readModule(dir: string, slug: string): Promise<string> {
  return fs.readFile(path.join(DATA_DIR, dir, `${slug}.ts`), "utf-8")
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function wireFile(
  dir: string,
  varName: string,
  slug: string,
  arrayName: string,
): Promise<void> {
  const indexFile = path.join(DATA_DIR, dir, "index.ts")
  const source = await fs.readFile(indexFile, "utf-8")
  await fs.writeFile(
    indexFile,
    wireIntoIndex(source, varName, `./${slug}`, arrayName),
  )
}

// --- Interactive selection (impure) ---

async function pickCharacter(
  characters: CharacterEntry[],
  fragment: string,
): Promise<CharacterEntry> {
  const matches = matchCharacters(characters, fragment)
  if (matches.length === 0) {
    throw new Error(
      fragment
        ? `No SSR character matches "${fragment}". Try pnpm catalog:refresh if it is new.`
        : "Catalog has no characters. Run pnpm catalog:refresh.",
    )
  }
  if (matches.length === 1) return matches[0]
  return select(
    "Character",
    matches.map((c) => ({
      label: `${c.name} (${c.element}, ${c.weaponType})`,
      value: c,
    })),
  )
}

async function pickWeapon(
  weapons: WeaponEntry[],
  weaponType: string,
): Promise<WeaponEntry> {
  const ofType = weapons.filter((w) => w.weaponType === weaponType)
  return select(
    `Weapon (${weaponType})`,
    ofType.map((w) => ({ label: w.name, value: w })),
  )
}

const WIDEN = Symbol("widen")

async function pickEcho(
  echoes: EchoEntry[],
  element: Element,
): Promise<EchoEntry> {
  const tiers: { tier: EchoTier; widenLabel: string }[] = [
    { tier: "locked", widenLabel: "Other (neutral sets)" },
    { tier: "cost4", widenLabel: "Other (3-cost echoes)" },
    { tier: "cost3", widenLabel: "" },
  ]
  for (const { tier, widenLabel } of tiers) {
    const list = echoesForTier(echoes, element, tier)
    const choices: Choice<EchoEntry | typeof WIDEN>[] = list.map((e) => ({
      label: `${e.name}  [${e.sets.map((s) => s.name).join(" / ")}]`,
      value: e,
    }))
    if (widenLabel) choices.push({ label: widenLabel, value: WIDEN })
    const picked = await select(`Echo (${element})`, choices)
    if (picked !== WIDEN) return picked
  }
  throw new Error("No echo selected")
}

// Existence check, not a module import: importing the echo-sets index here would
// cache it before the new set is wired, poisoning the final resolve check.
async function isSetWired(setName: string): Promise<boolean> {
  const file = path.join(DATA_DIR, "echo-sets", `${slugify(setName)}.ts`)
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function pickSet(echo: EchoEntry): Promise<string> {
  const wired = new Set<string>()
  for (const s of echo.sets) {
    if (await isSetWired(s.name)) wired.add(s.name)
  }
  return select(
    "Echo set",
    echo.sets.map((s) => ({
      label: `${s.name}${wired.has(s.name) ? "" : "  (not yet in repo)"}`,
      value: s.name,
    })),
  )
}

// --- Orchestration ---

interface Flags {
  fragment: string
  weapon?: string
  echo?: string
  set?: string
}

const VALUE_FLAGS = ["weapon", "echo", "set"] as const
type ValueFlag = (typeof VALUE_FLAGS)[number]

function asValueFlag(arg: string): ValueFlag | undefined {
  const name = arg.startsWith("--") ? arg.slice(2) : ""
  return (VALUE_FLAGS as readonly string[]).includes(name)
    ? (name as ValueFlag)
    : undefined
}

export function parseArgs(argv: string[]): Flags {
  const flags: Flags = { fragment: "" }
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const flag = asValueFlag(argv[i])
    if (flag) {
      const value = argv[i + 1]
      if (i + 1 >= argv.length || value.startsWith("--")) {
        throw new Error(`--${flag} needs a value`)
      }
      flags[flag] = value
      i++
    } else positional.push(argv[i])
  }
  flags.fragment = positional.join(" ")
  return flags
}

function byName<T extends { name: string }>(
  items: T[],
  name: string,
  kind: string,
): T {
  const found = items.find((i) => i.name.toLowerCase() === name.toLowerCase())
  if (!found) throw new Error(`No ${kind} named "${name}" in catalog`)
  return found
}

async function run(argv: string[]): Promise<void> {
  const flags = parseArgs(argv)
  const catalog = await loadCatalog()

  const age = catalogAgeDays(catalog.meta)
  if (age > STALE_DAYS) {
    console.warn(
      `Catalog is ${Math.round(age)} days old. Consider pnpm catalog:refresh.`,
    )
  }

  const character = await pickCharacter(catalog.characters, flags.fragment)
  console.log(`\nExtracting ${character.name}...`)
  await extractCharacter(String(character.id))
  const slug = slugify(character.name)

  const weapon = flags.weapon
    ? byName(catalog.weapons, flags.weapon, "weapon")
    : await pickWeapon(catalog.weapons, character.weaponType)

  const echo = flags.echo
    ? byName(catalog.echoes, flags.echo, "echo")
    : await pickEcho(catalog.echoes, character.element)

  const setName = flags.set ?? (await pickSet(echo))
  if (!echo.sets.some((s) => s.name === setName)) {
    throw new Error(`${echo.name} does not unlock set "${setName}"`)
  }

  console.log(`Extracting ${weapon.name} and ${echo.name}...`)
  await extractWeapon(String(weapon.id))
  await extractEcho(String(echo.id))

  const weaponSlug = slugify(weapon.name)
  const echoSlug = slugify(echo.name)
  const setSlug = slugify(setName)

  const created: Record<string, WriteResult> = {}
  created[`characters/${slug}.ts`] = await writeIfAbsent(
    path.join(DATA_DIR, "characters", `${slug}.ts`),
    formatCharacter(
      await readRaw<Character>("characters", slug),
      toVarName(slug),
    ),
  )
  created[`weapons/${weaponSlug}.ts`] = await writeIfAbsent(
    path.join(DATA_DIR, "weapons", `${weaponSlug}.ts`),
    formatWeapon(
      await readRaw<Weapon>("weapons", weaponSlug),
      toVarName(weaponSlug),
    ),
  )
  created[`echoes/${echoSlug}.ts`] = await writeIfAbsent(
    path.join(DATA_DIR, "echoes", `${echoSlug}.ts`),
    formatEcho(await readRaw<Echo>("echoes", echoSlug), toVarName(echoSlug)),
  )
  const setRaw = await readRaw<EchoSet>("echo-sets", setSlug)
  created[`echo-sets/${setSlug}.ts`] = await writeIfAbsent(
    path.join(DATA_DIR, "echo-sets", `${setSlug}.ts`),
    formatEchoSet(setRaw.type, toVarName(setSlug), setSlug),
  )

  await wireFile("characters", toVarName(slug), slug, "ALL_CHARACTERS")
  await wireFile("weapons", toVarName(weaponSlug), weaponSlug, "ALL_WEAPONS")
  await wireFile("echoes", toVarName(echoSlug), echoSlug, "ALL_ECHOES")
  await wireFile("echo-sets", toVarName(setSlug), setSlug, "ALL_ECHO_SETS")

  const charFile = path.join(DATA_DIR, "characters", `${slug}.ts`)
  const template: Template = {
    weapon: weapon.name,
    echo: echo.name,
    echoSet: setName,
  }
  await fs.writeFile(
    charFile,
    patchTemplate(await fs.readFile(charFile, "utf-8"), template),
  )

  // First load of the data indexes in this process: reads the just-wired files
  // from disk. Keep it ahead of any earlier index import, else it resolves ids
  // against a stale cached module.
  const { loadoutFromTemplate } = await import("../src/lib/loadout/template.js")
  const loadout = loadoutFromTemplate(template)
  const unresolved: string[] = []
  if (loadout.weaponId == null) unresolved.push("weapon")
  if (loadout.echoId == null) unresolved.push("echo")
  if (loadout.echoSetSlot1Id == null) unresolved.push("echoSet")

  // Regenerate share wire tables against the now-wired indexes; the generator
  // runs on import.
  await import("./generate-wire-tables.js")

  const outstanding: string[] = []
  const charSource = await fs.readFile(charFile, "utf-8")
  for (const p of characterPlaceholders(charSource)) {
    outstanding.push(`characters/${slug}.ts: ${p}`)
  }
  if (hasEmptyBuffs(await readModule("weapons", weaponSlug))) {
    outstanding.push(`weapons/${weaponSlug}.ts: no passive buff authored`)
  }
  if (hasEmptyBuffs(await readModule("echoes", echoSlug))) {
    outstanding.push(`echoes/${echoSlug}.ts: no echo buff authored`)
  }
  if (hasEmptyBuffs(await readModule("echo-sets", setSlug))) {
    outstanding.push(
      `echo-sets/${setSlug}.ts: no buffs authored (${setRaw.effects.length} effects)`,
    )
  }
  const testFile = path.join(DATA_DIR, "characters", `${slug}.test.ts`)
  if (!(await exists(testFile))) {
    outstanding.push(`characters/${slug}.test.ts: no e2e rotation test`)
  }
  for (const u of unresolved) {
    outstanding.push(`template ${u} does not resolve in the catalog`)
  }

  console.log(`\n${character.name}`)
  for (const [file, result] of Object.entries(created)) {
    console.log(`  ${result === "created" ? "+" : "="} ${file} (${result})`)
  }
  console.log("  = wired 4 index files and share wire tables")
  console.log(
    `  = template: ${template.weapon} / ${template.echo} / ${template.echoSet}`,
  )

  console.log(`\nOutstanding (hand-authoring, out of this tool's scope):`)
  for (const item of outstanding) console.log(`  ! ${item}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).catch((err: Error) => {
    console.error(err.message)
    process.exit(1)
  })
}
