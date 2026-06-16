import type {
  EnrichedCharacter,
  EnrichedSkillAttribute,
  StageVariant,
} from "#/types/character"
import { hitsByStage, resolveVariantTarget, sections } from "./types"
import type { Clip, StageRef, VariantTrack } from "./types"

/** One leaf the patch overwrites, for the diff surface. */
export interface Change {
  path: string
  before: unknown
  after: unknown
}

export interface EmitResult {
  /** The whole character object, cloned and sparse-patched with the clip's measurements. */
  patched: EnrichedCharacter
  ts: string
  changes: Change[]
  warnings: string[]
}

/** Find the registry stage matching a clip's `StageRef`, by the same id derivation `stages.ts` uses. */
function locateStage(
  char: EnrichedCharacter,
  ref: StageRef,
): EnrichedSkillAttribute | undefined {
  const skill = char.skills.find((s) => s.name === ref.skill)
  return skill?.stages.find(
    (st) => `${skill.name}::${st.key ?? st.name}` === ref.id,
  )
}

/** Stage-occurrence indices whose `StageRef.id` appears more than once in the clip. */
function duplicateOccurrences(clip: Clip): Set<number> {
  const counts = new Map<string, number>()
  for (const ref of clip.stageRefs)
    counts.set(ref.id, (counts.get(ref.id) ?? 0) + 1)
  const dupes = new Set<number>()
  clip.stageRefs.forEach((ref, i) => {
    if ((counts.get(ref.id) ?? 0) > 1) dupes.add(i)
  })
  return dupes
}

/**
 * The cancel track resolves to either `cancel` or `instantCancel` (pin to start);
 * swap resolves to `swap`. Returns the emitted key so the patch can clear the
 * cancel-track sibling it didn't pick.
 */
function variantKeyFor(
  track: VariantTrack,
  target: { kind: string },
): "cancel" | "instantCancel" | "swap" {
  if (track === "swap") return "swap"
  return target.kind === "start" ? "instantCancel" : "cancel"
}

/**
 * Clone the character and sparse-patch only what the selected clip measured:
 * each contained stage's `actionTime` (section width), its hits' `actionFrame`s
 * (positional, capped at the entry count), and its resolved variants. A stage the
 * clip repeats can't patch one slot twice, so it is skipped with a warning. The
 * registry's untouched fields stay byte-equal, keeping the diff tight.
 */
export function patchCharacter(
  char: EnrichedCharacter,
  clip: Clip,
): EmitResult {
  const patched = structuredClone(char)
  const changes: Change[] = []
  const warnings: string[] = []
  const secs = sections(clip)
  const byStage = hitsByStage(clip)
  const dupes = duplicateOccurrences(clip)
  const warnedDupes = new Set<string>()

  clip.stageRefs.forEach((ref, i) => {
    if (dupes.has(i)) {
      if (!warnedDupes.has(ref.id)) {
        warnedDupes.add(ref.id)
        warnings.push(
          `${ref.stage} appears more than once in this clip — skipped (split it into single-occurrence clips).`,
        )
      }
      return
    }

    const stage = locateStage(patched, ref)
    if (!stage) {
      warnings.push(`${ref.stage} not found in the registry — skipped.`)
      return
    }

    const sec = secs[i]
    const width = sec.end - sec.start
    if (stage.actionTime !== width) {
      changes.push({
        path: `${ref.stage}.actionTime`,
        before: stage.actionTime,
        after: width,
      })
      stage.actionTime = width
    }

    const hits = byStage[i] ?? []
    const damage = stage.damage ?? []
    const n = Math.min(hits.length, damage.length)
    for (let k = 0; k < n; k++) {
      const actionFrame = hits[k].frame - sec.start
      if (damage[k].actionFrame !== actionFrame) {
        changes.push({
          path: `${ref.stage}.damage[${k}].actionFrame`,
          before: damage[k].actionFrame,
          after: actionFrame,
        })
        damage[k].actionFrame = actionFrame
      }
    }

    const pins = clip.variants?.[i]
    for (const track of ["cancel", "swap"] as const) {
      const target = pins?.[track]
      if (!target) continue
      const resolved = resolveVariantTarget(clip, i, target)
      if (!resolved.ok) {
        warnings.push(`${ref.stage} ${track} unresolved — ${resolved.reason}.`)
        continue
      }
      const key = variantKeyFor(track, target)
      const value: StageVariant = { actionTime: resolved.actionTime }
      stage.variants ??= {}
      // The cancel track owns both keys; drop the sibling it didn't resolve to.
      if (track === "cancel") {
        const sibling = key === "cancel" ? "instantCancel" : "cancel"
        if (stage.variants[sibling]) {
          changes.push({
            path: `${ref.stage}.variants.${sibling}`,
            before: stage.variants[sibling],
            after: undefined,
          })
          delete stage.variants[sibling]
        }
      }
      const before = stage.variants[key]
      if (before?.actionTime !== value.actionTime) {
        changes.push({
          path: `${ref.stage}.variants.${key}`,
          before,
          after: value,
        })
      }
      stage.variants[key] = value
    }
  })

  return {
    patched,
    ts: characterToTs(patched),
    changes,
    warnings,
  }
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** Render a value as a TS literal: unquoted identifier keys, double-quoted strings, trailing commas. */
function toTsLiteral(value: unknown, indent: string): string {
  if (value === null) return "null"
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  if (typeof value === "string") return JSON.stringify(value)
  const inner = indent + "  "
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    const items = value.map((v) => inner + toTsLiteral(v, inner))
    return `[\n${items.join(",\n")},\n${indent}]`
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    )
    if (entries.length === 0) return "{}"
    const lines = entries.map(
      ([k, v]) =>
        `${inner}${IDENTIFIER.test(k) ? k : JSON.stringify(k)}: ${toTsLiteral(v, inner)}`,
    )
    return `{\n${lines.join(",\n")},\n${indent}}`
  }
  return "null"
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

/** Serialize a character to a paste-ready `.ts` literal — the diff's two sides go through this same path, so the diff is noise-free. */
export function characterToTs(char: EnrichedCharacter): string {
  return `import type { EnrichedCharacter } from "#/types/character"\n\nexport const ${constName(char.name)} = ${toTsLiteral(char, "")} satisfies EnrichedCharacter\n`
}
