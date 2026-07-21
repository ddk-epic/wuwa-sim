import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { EchoSet } from "../src/types/echo-set.js"
import { toVarName } from "./lib/slugify.js"

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)

export function formatEchoSet(
  type: EchoSet["type"],
  varName: string,
  slug: string,
): string {
  return [
    `import type { EchoSet } from "#/types/echo-set"`,
    `import raw from "./raw/${slug}.json"`,
    ``,
    `export const ${varName} = {`,
    `  ...raw,`,
    // JSON widens the literal to string; the resolver reads this to size the second slot.
    `  type: raw.type as ${JSON.stringify(type)},`,
    `  buffs: [],`,
    `} satisfies EchoSet`,
    ``,
  ].join("\n")
}

async function generateEchoSet(name: string): Promise<void> {
  const rawPath = path.join(
    PROJECT_ROOT,
    "src/data/echo-sets/raw",
    `${name}.json`,
  )
  const outputPath = path.join(PROJECT_ROOT, "src/data/echo-sets", `${name}.ts`)

  try {
    await fs.access(outputPath)
    console.warn(
      `Warning: src/data/echo-sets/${name}.ts already exists — refusing to overwrite`,
    )
    process.exit(1)
  } catch {
    // File doesn't exist, proceed
  }

  let raw: string
  try {
    raw = await fs.readFile(rawPath, "utf-8")
  } catch {
    console.error(`Error: src/data/echo-sets/raw/${name}.json not found`)
    process.exit(1)
  }

  // extract-echo strips buffs before writing raw
  const set: Omit<EchoSet, "buffs"> = JSON.parse(raw)
  const varName = toVarName(name)

  await fs.writeFile(outputPath, formatEchoSet(set.type, varName, name))
  console.log(`Written to src/data/echo-sets/${name}.ts`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv[2]
  if (!name) {
    console.error("Usage: tsx scripts/generate-echo-set.ts <name>")
    process.exit(1)
  }
  generateEchoSet(name).catch((err: Error) => {
    console.error(err.message)
    process.exit(1)
  })
}
