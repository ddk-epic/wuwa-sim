#!/usr/bin/env tsx
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SkillMetadata, StageMetadata } from '#/types/character'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const charsDir = join(root, 'src', 'data', 'characters')
const metaPath = join(charsDir, 'skill-metadata.ts')

const { SKILL_METADATA } = await import('#/data/characters/skill-metadata')
const current: Record<string, SkillMetadata[]> = { ...SKILL_METADATA }

const files = (await readdir(charsDir)).filter((f) => f.endsWith('.json'))

for (const file of files) {
  const char = JSON.parse(await readFile(join(charsDir, file), 'utf-8')) as {
    name: string
    skills: Array<{ name: string; stages: Array<{ name: string }> }>
  }
  const charName = char.name
  const existing: SkillMetadata[] = current[charName] ?? []

  for (const skill of char.skills) {
    if (!skill.name) continue
    const skillEntry = existing.find((m) => m.name === skill.name)
    const existingStages: StageMetadata[] = skillEntry?.stages ?? []
    const stages: StageMetadata[] = [...existingStages]
    let changed = false

    for (const stage of skill.stages) {
      if (!stage.name) continue
      if (!stages.find((s) => s.name === stage.name)) {
        stages.push({ name: stage.name, actionTime: 0 })
        changed = true
      }
    }

    if (changed || !skillEntry) {
      const idx = existing.findIndex((m) => m.name === skill.name)
      const updated: SkillMetadata = skillEntry
        ? { ...skillEntry, stages }
        : { name: skill.name, stages }
      if (idx >= 0) existing[idx] = updated
      else existing.push(updated)
    }
  }

  current[charName] = existing
}

function serialize(val: unknown, depth = 0): string {
  const pad = '  '.repeat(depth)
  const inner = '  '.repeat(depth + 1)
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (typeof val === 'string')
    return `'${val.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  if (val === null) return 'null'
  if (Array.isArray(val)) {
    if (!val.length) return '[]'
    return `[\n${val.map((v) => `${inner}${serialize(v, depth + 1)}`).join(',\n')},\n${pad}]`
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>)
    if (!entries.length) return '{}'
    const lines = entries.map(([k, v]) => {
      const isIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)
      const key = isIdentifier
        ? k
        : `'${k.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
      return `${inner}${key}: ${serialize(v, depth + 1)}`
    })
    return `{\n${lines.join(',\n')},\n${pad}}`
  }
  return String(val)
}

const body = serialize(current)
const output = `import type { SkillMetadata } from '#/types/character'\n\nexport const SKILL_METADATA: Record<string, SkillMetadata[]> = ${body}\n`

await writeFile(metaPath, output, 'utf-8')
console.log(`gen:metadata: updated ${metaPath}`)
