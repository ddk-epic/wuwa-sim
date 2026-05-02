import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Weapon } from "../src/types/weapon.js"

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)

export function formatWeapon(weapon: Weapon, varName: string): string {
  const s = (v: string) => JSON.stringify(v)
  return [
    `import type { EnrichedWeapon } from '#/types/weapon'`,
    ``,
    `export const ${varName} = {`,
    `  id: ${weapon.id},`,
    `  name: ${s(weapon.name)},`,
    `  weaponType: ${s(weapon.weaponType)},`,
    `  stats: {`,
    `    main: { name: ${s(weapon.stats.main.name)}, base: ${weapon.stats.main.base}, max: ${weapon.stats.main.max} },`,
    `    sub: { name: ${s(weapon.stats.sub.name)}, base: ${weapon.stats.sub.base}, max: ${weapon.stats.sub.max} },`,
    `  },`,
    `  passive: { name: ${s(weapon.passive.name)} },`,
    `  buffs: [],`,
    `} satisfies EnrichedWeapon`,
    ``,
  ].join("\n")
}

async function generateWeapon(slug: string): Promise<void> {
  const rawPath = path.join(
    PROJECT_ROOT,
    "src/data/weapons/raw",
    `${slug}.json`,
  )
  const outputPath = path.join(PROJECT_ROOT, "src/data/weapons", `${slug}.ts`)

  try {
    await fs.access(outputPath)
    console.warn(
      `Warning: src/data/weapons/${slug}.ts already exists — refusing to overwrite`,
    )
    process.exit(1)
  } catch {
    // File doesn't exist, proceed
  }

  let raw: string
  try {
    raw = await fs.readFile(rawPath, "utf-8")
  } catch {
    console.error(`Error: src/data/weapons/raw/${slug}.json not found`)
    process.exit(1)
  }

  const weapon: Weapon = JSON.parse(raw)
  const varName = slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

  await fs.writeFile(outputPath, formatWeapon(weapon, varName))
  console.log(`Written to src/data/weapons/${slug}.ts`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2]
  if (!slug) {
    console.error("Usage: tsx scripts/generate-weapon.ts <slug>")
    process.exit(1)
  }
  generateWeapon(slug).catch((err: Error) => {
    console.error(err.message)
    process.exit(1)
  })
}
