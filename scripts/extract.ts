import { extractCharacter } from './extract-character.js'
import { extractWeapon } from './extract-weapon.js'
import { extractEcho } from './extract-echo.js'

type EntityType = 'character' | 'weapon' | 'echo'

function detectType(id: string): EntityType | null {
  if (/^1\d{3}$/.test(id)) return 'character'
  if (/^21\d{6}$/.test(id)) return 'weapon'
  if (/^6\d{6}$/.test(id) || /^39\d{7}$/.test(id)) return 'echo'
  return null
}

const args = process.argv.slice(2)
const typeIndex = args.indexOf('--type')
const explicitType =
  typeIndex !== -1 ? (args[typeIndex + 1] as EntityType) : undefined
const id = args.find((_, i) => !args[i].startsWith('--') && i !== typeIndex + 1)

if (!id) {
  console.error('Usage: pnpm extract <id> [--type character|weapon|echo]')
  process.exit(1)
}

const type = explicitType ?? detectType(id)

if (!type) {
  console.error(
    `Could not detect entity type for id "${id}". Use --type character|weapon|echo.`,
  )
  process.exit(1)
}

const extractors: Record<EntityType, (id: string) => Promise<void>> = {
  character: extractCharacter,
  weapon: extractWeapon,
  echo: extractEcho,
}

extractors[type](id).catch((err) => {
  console.error(err.message)
  process.exit(1)
})
