import type { EnrichedCharacter } from "#/types/character"

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const PRINT_WIDTH = 80

const tsKey = (k: string) => (IDENTIFIER.test(k) ? k : JSON.stringify(k))

const objectEntries = (value: object): [string, unknown][] =>
  Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined,
  )

/** Single-line rendering, for the width-fit test. */
function inlineLiteral(value: unknown): string {
  if (value === null) return "null"
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  if (typeof value === "string") return JSON.stringify(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    return `[${value.map(inlineLiteral).join(", ")}]`
  }
  if (typeof value === "object") {
    const entries = objectEntries(value)
    if (entries.length === 0) return "{}"
    return `{ ${entries.map(([k, v]) => `${tsKey(k)}: ${inlineLiteral(v)}`).join(", ")} }`
  }
  return "null"
}

const isNonEmptyObject = (v: unknown): boolean =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  objectEntries(v).length > 0

// Smallest buffs-section object that must break one key per line.
const BUFFS_BREAK_KEYS = 3

/**
 * Layout breaks independent of width, to match the authored files: every skill
 * object breaks (even a tiny one like a bare `Tune Break`), the `variants` map
 * always breaks, and a `buffs` object with 3+ keys breaks. Propagates, so a
 * container can't inline a descendant that must break.
 */
function mustBreak(value: unknown, inBuffs: boolean): boolean {
  if (Array.isArray(value)) return value.some((v) => mustBreak(v, inBuffs))
  if (typeof value === "object" && value !== null) {
    const entries = objectEntries(value)
    if ("stages" in value) return true
    if (inBuffs && entries.length >= BUFFS_BREAK_KEYS) return true
    return entries.some(
      ([k, v]) =>
        (k === "variants" && isNonEmptyObject(v)) ||
        mustBreak(v, inBuffs || k === "buffs"),
    )
  }
  return false
}

/**
 * Render a TS literal, preferring one line: a value stays inline unless it would
 * overflow `col` past the print width or it `mustBreak`s, then the container
 * breaks and each child is re-tried. Tuned to prettier's defaults so a paste
 * needs no reflow.
 */
function toTsLiteral(
  value: unknown,
  pad: string,
  col: number,
  inBuffs = false,
  forceBreak = false,
): string {
  const flat = inlineLiteral(value)
  if (
    !forceBreak &&
    !mustBreak(value, inBuffs) &&
    col + flat.length <= PRINT_WIDTH
  )
    return flat
  const inner = pad + "  "
  if (Array.isArray(value)) {
    const items = value.map(
      (v) => inner + toTsLiteral(v, inner, inner.length, inBuffs),
    )
    return `[\n${items.join(",\n")},\n${pad}]`
  }
  if (typeof value === "object" && value !== null) {
    const lines = objectEntries(value).map(([k, v]) => {
      const key = tsKey(k)
      const childInBuffs = inBuffs || k === "buffs"
      const breakChild = k === "variants" && isNonEmptyObject(v)
      return `${inner}${key}: ${toTsLiteral(v, inner, inner.length + key.length + 2, childInBuffs, breakChild)}`
    })
    return `{\n${lines.join(",\n")},\n${pad}}`
  }
  // A primitive too long for the budget (e.g. a long string) can't break.
  return flat
}

/** camelCase the character name for the `export const` binding (e.g. "Inferno Rider" → "infernoRider"). */
function constName(name: string): string {
  const parts = name.split(/[^A-Za-z0-9]+/).filter(Boolean)
  return parts
    .map((p, i) =>
      i === 0
        ? p[0].toLowerCase() + p.slice(1)
        : p[0].toUpperCase() + p.slice(1),
    )
    .join("")
}

/**
 * Serialize to a paste-ready `.ts` literal. Drops the injected Movement skills
 * (Dodge/Jump) — added to the runtime object at load, not authored in the file.
 */
export function characterToTs(char: EnrichedCharacter): string {
  const authored = {
    ...char,
    skills: char.skills.filter((s) => s.type !== "Movement"),
  }
  const binding = `export const ${constName(char.name)} = `
  return `import type { EnrichedCharacter } from "#/types/character"\n\n${binding}${toTsLiteral(authored, "", binding.length)} satisfies EnrichedCharacter\n`
}
