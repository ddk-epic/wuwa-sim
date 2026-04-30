import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type {
  Character,
  DamageEntry,
  SkillAttribute,
} from "../src/types/character.js"

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)

function s(v: string): string {
  return JSON.stringify(v)
}

function ind(level: number): string {
  return "  ".repeat(level)
}

function formatDamageEntry(d: DamageEntry, level: number): string {
  const l = ind(level)
  const l1 = ind(level + 1)
  return [
    `${l}{`,
    `${l1}type: ${s(d.type)},`,
    `${l1}dmgType: ${s(d.dmgType)},`,
    `${l1}scalingStat: ${s(d.scalingStat)},`,
    `${l1}actionFrame: 0,`,
    `${l1}value: ${d.value},`,
    `${l1}energy: ${d.energy},`,
    `${l1}concerto: ${d.concerto},`,
    `${l1}toughness: ${d.toughness},`,
    `${l1}weakness: ${d.weakness},`,
    `${l}}`,
  ].join("\n")
}

function formatStage(stage: SkillAttribute, level: number): string {
  const l = ind(level)
  const l1 = ind(level + 1)
  const lines: string[] = [
    `${l}{`,
    `${l1}name: ${s(stage.name)},`,
    `${l1}newName: '',`,
    `${l1}value: ${s(stage.value)},`,
  ]
  if (stage.cooldown !== undefined)
    lines.push(`${l1}cooldown: ${stage.cooldown},`)
  if (stage.concerto !== undefined)
    lines.push(`${l1}concerto: ${stage.concerto},`)
  lines.push(`${l1}actionTime: 0,`)
  if (stage.damage && stage.damage.length > 0) {
    lines.push(`${l1}damage: [`)
    for (const d of stage.damage)
      lines.push(formatDamageEntry(d, level + 2) + ",")
    lines.push(`${l1}],`)
  } else {
    lines.push(`${l1}damage: [],`)
  }
  lines.push(`${l}}`)
  return lines.join("\n")
}

function formatSkill(
  skill: Character["skills"][number],
  level: number,
): string {
  const l = ind(level)
  const l1 = ind(level + 1)
  const lines: string[] = [
    `${l}{`,
    `${l1}id: ${skill.id},`,
    `${l1}name: ${s(skill.name)},`,
    `${l1}type: ${s(skill.type)},`,
  ]
  if (skill.cooldown !== undefined)
    lines.push(`${l1}cooldown: ${skill.cooldown},`)
  if (skill.duration !== undefined)
    lines.push(`${l1}duration: ${skill.duration},`)
  if (skill.concerto !== undefined)
    lines.push(`${l1}concerto: ${skill.concerto},`)
  if (skill.resonanceCost !== undefined)
    lines.push(`${l1}resonanceCost: ${skill.resonanceCost},`)
  lines.push(`${l1}// hidden: true,`)
  lines.push(`${l1}// animationLock: 0,`)
  if (skill.stages.length > 0) {
    lines.push(`${l1}stages: [`)
    for (const stage of skill.stages)
      lines.push(formatStage(stage, level + 2) + ",")
    lines.push(`${l1}],`)
  } else {
    lines.push(`${l1}stages: [],`)
  }
  if (skill.damage.length > 0) {
    lines.push(`${l1}damage: [`)
    for (const d of skill.damage)
      lines.push(formatDamageEntry(d, level + 2) + ",")
    lines.push(`${l1}],`)
  } else {
    lines.push(`${l1}damage: [],`)
  }
  lines.push(`${l}}`)
  return lines.join("\n")
}

async function generateCharacter(name: string): Promise<void> {
  const rawPath = path.join(
    PROJECT_ROOT,
    "src/data/characters/raw",
    `${name}.json`,
  )
  const outputPath = path.join(
    PROJECT_ROOT,
    "src/data/characters",
    `${name}.ts`,
  )

  try {
    await fs.access(outputPath)
    console.warn(
      `Warning: src/data/characters/${name}.ts already exists — refusing to overwrite`,
    )
    process.exit(1)
  } catch {
    // File doesn't exist, proceed
  }

  let raw: string
  try {
    raw = await fs.readFile(rawPath, "utf-8")
  } catch {
    console.error(`Error: src/data/characters/raw/${name}.json not found`)
    process.exit(1)
  }

  const char: Character = JSON.parse(raw)
  const varName = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

  const lines: string[] = [
    `import type { EnrichedCharacter } from '#/types/character'`,
    ``,
    `export const ${varName} = {`,
    `  id: ${char.id},`,
    `  name: ${s(char.name)},`,
    `  element: ${s(char.element)},`,
    `  weaponType: ${s(char.weaponType)},`,
    `  rarity: ${s(char.rarity)},`,
    `  stats: {`,
    `    base: { hp: ${char.stats.base.hp}, atk: ${char.stats.base.atk}, def: ${char.stats.base.def} },`,
    `    max: { hp: ${char.stats.max.hp}, atk: ${char.stats.max.atk}, def: ${char.stats.max.def} },`,
    `  },`,
    `  skills: [`,
  ]

  for (const skill of char.skills) {
    lines.push(formatSkill(skill, 2) + ",")
  }

  lines.push(`  ],`)
  lines.push(`} satisfies EnrichedCharacter`)
  lines.push(``)

  await fs.writeFile(outputPath, lines.join("\n"))
  console.log(`Written to src/data/characters/${name}.ts`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv[2]
  if (!name) {
    console.error("Usage: tsx scripts/generate-character.ts <name>")
    process.exit(1)
  }
  generateCharacter(name).catch((err: Error) => {
    console.error(err.message)
    process.exit(1)
  })
}
