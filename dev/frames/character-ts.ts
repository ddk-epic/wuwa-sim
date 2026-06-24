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

// Smallest buffs-section object that breaks one key per line.
const BUFFS_BREAK_KEYS = 3

/**
 * Phase 1 — the only place character-schema knowledge lives. A container is
 * forced to break regardless of width when, to match the authored files, it is
 * a skill object (has `stages`), a non-empty `variants` map, or a `buffs`-section
 * object with 3+ keys — or it contains a descendant that is. Computed once per
 * serialization; `inBuffs` rides down so the 3-key rule only fires under `buffs`.
 */
export function forcedBreaks(root: unknown): WeakSet<object> {
  const forced = new WeakSet<object>()

  function walk(
    value: unknown,
    isVariants: boolean,
    inBuffs: boolean,
  ): boolean {
    if (Array.isArray(value)) {
      let any = false
      for (const v of value) if (walk(v, false, inBuffs)) any = true
      if (any) forced.add(value)
      return any
    }
    if (typeof value === "object" && value !== null) {
      const entries = objectEntries(value)
      let broken =
        "stages" in value ||
        (isVariants && entries.length > 0) ||
        (inBuffs && entries.length >= BUFFS_BREAK_KEYS)
      for (const [k, v] of entries)
        if (walk(v, k === "variants", inBuffs || k === "buffs")) broken = true
      if (broken) forced.add(value)
      return broken
    }
    return false
  }

  walk(root, false, false)
  return forced
}

/**
 * Phase 2 — generic: a value stays on one line unless `forced` marks it or it
 * overflows `col` past the print width, then the container breaks and each child
 * is re-tried. No character-schema branches. Tuned to prettier's defaults so a
 * paste needs no reflow.
 */
export function toTsLiteral(
  value: unknown,
  pad: string,
  col: number,
  forced: WeakSet<object>,
): string {
  const flat = inlineLiteral(value)
  const mustBreak =
    typeof value === "object" && value !== null && forced.has(value)
  if (!mustBreak && col + flat.length <= PRINT_WIDTH) return flat
  const inner = pad + "  "
  if (Array.isArray(value)) {
    const items = value.map(
      (v) => inner + toTsLiteral(v, inner, inner.length, forced),
    )
    return `[\n${items.join(",\n")},\n${pad}]`
  }
  if (typeof value === "object" && value !== null) {
    const lines = objectEntries(value).map(([k, v]) => {
      const key = tsKey(k)
      return `${inner}${key}: ${toTsLiteral(v, inner, inner.length + key.length + 2, forced)}`
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
  const forced = forcedBreaks(authored)
  return `import type { EnrichedCharacter } from "#/types/character"\n\n${binding}${toTsLiteral(authored, "", binding.length, forced)} satisfies EnrichedCharacter\n`
}
