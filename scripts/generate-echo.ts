import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Echo, DamageEntry } from '../src/types/echo.js'

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function s(v: string): string {
  return JSON.stringify(v)
}

function ind(level: number): string {
  return '  '.repeat(level)
}

function formatDamageEntry(d: DamageEntry, level: number): string {
  const l = ind(level)
  const l1 = ind(level + 1)
  return [
    `${l}{`,
    `${l1}type: ${s(d.type)},`,
    `${l1}dmgType: ${s(d.dmgType)},`,
    `${l1}scalingStat: ${s(d.scalingStat)},`,
    `${l1}value: ${d.value},`,
    `${l1}energy: ${d.energy},`,
    `${l1}concerto: ${d.concerto},`,
    `${l1}toughness: ${d.toughness},`,
    `${l1}weakness: ${d.weakness},`,
    `${l}}`,
  ].join('\n')
}

export function formatStage(
  stageName: string,
  hits: DamageEntry[],
  level: number,
  hidden = false,
): string {
  const l = ind(level)
  const l1 = ind(level + 1)
  const lines: string[] = [
    `${l}{`,
    `${l1}name: ${s(stageName)},`,
    `${l1}newName: '(${stageName})',`,
  ]
  if (hidden) lines.push(`${l1}hidden: true,`)
  lines.push(`${l1}actionTime: 0,`)
  lines.push(`${l1}damage: [`)
  for (const d of hits) {
    lines.push(formatDamageEntry(d, level + 2) + ',')
  }
  lines.push(`${l1}],`)
  lines.push(`${l}}`)
  return lines.join('\n')
}

async function generateEcho(name: string): Promise<void> {
  const rawPath = path.join(PROJECT_ROOT, 'src/data/echoes/raw', `${name}.json`)
  const outputPath = path.join(PROJECT_ROOT, 'src/data/echoes', `${name}.ts`)

  try {
    await fs.access(outputPath)
    console.warn(
      `Warning: src/data/echoes/${name}.ts already exists — refusing to overwrite`,
    )
    process.exit(1)
  } catch {
    // File doesn't exist, proceed
  }

  let raw: string
  try {
    raw = await fs.readFile(rawPath, 'utf-8')
  } catch {
    console.error(`Error: src/data/echoes/raw/${name}.json not found`)
    process.exit(1)
  }

  const echo: Echo = JSON.parse(raw)
  const varName = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

  const lines: string[] = [
    `import type { EnrichedEcho } from '#/types/echo'`,
    ``,
    `export const ${varName} = {`,
    `  id: ${echo.id},`,
    `  name: ${s(echo.name)},`,
    `  cost: ${echo.cost},`,
    `  element: ${s(echo.element)},`,
    `  set: ${s(echo.set)},`,
    `  skill: {`,
    `    cooldown: ${echo.skill.cooldown},`,
    `    description: ${s(echo.skill.description)},`,
    `    stages: [`,
  ]

  lines.push(formatStage('Tap', echo.skill.hits, 3) + ',')
  lines.push(formatStage('Hold', echo.skill.hits, 3, true) + ',')

  lines.push(`    ],`)
  lines.push(`  },`)
  lines.push(`} satisfies EnrichedEcho`)
  lines.push(``)

  await fs.writeFile(outputPath, lines.join('\n'))
  console.log(`Written to src/data/echoes/${name}.ts`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv[2]
  if (!name) {
    console.error('Usage: tsx scripts/generate-echo.ts <name>')
    process.exit(1)
  }
  generateEcho(name).catch((err: Error) => {
    console.error(err.message)
    process.exit(1)
  })
}
