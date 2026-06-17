import type {
  EnrichedCharacter,
  EnrichedSkillAttribute,
  StageVariant,
} from "#/types/character"
import {
  hitsByStage,
  resolveVariantTarget,
  sections,
  stageTiming,
} from "./types"
import type { Clip, StageRef, VariantTrack } from "./types"

export interface Change {
  path: string
  before: unknown
  after: unknown
}

export interface ExportResult {
  patched: EnrichedCharacter
  ts: string
  changes: Change[]
  warnings: string[]
}

/** Same id derivation as `stages.ts`, so a clip's `StageRef` finds its registry stage. */
function locateStage(
  char: EnrichedCharacter,
  ref: StageRef,
): EnrichedSkillAttribute | undefined {
  const skill = char.skills.find((s) => s.name === ref.skill)
  return skill?.stages.find(
    (st) => `${skill.name}::${st.key ?? st.name}` === ref.id,
  )
}

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

/** A cancel pinned to start becomes `instantCancel`; otherwise the track's own key. */
function variantKeyFor(
  track: VariantTrack,
  target: { kind: string },
): "cancel" | "instantCancel" | "swap" {
  if (track === "swap") return "swap"
  return target.kind === "start" ? "instantCancel" : "cancel"
}

/**
 * Clone the character and sparse-patch only what the clip measured, leaving the
 * rest byte-equal so the diff stays tight. A repeated stage can't patch one slot
 * twice, so it's skipped with a warning.
 */
export function buildExport(char: EnrichedCharacter, clip: Clip): ExportResult {
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
    const split = clip.animationSplits?.[i] ?? null
    const { animationFrames, actionTime } = stageTiming(clip, i, secs)
    if (stage.actionTime !== actionTime) {
      changes.push({
        path: `${ref.stage}.actionTime`,
        before: stage.actionTime,
        after: actionTime,
      })
      stage.actionTime = actionTime
    }
    if (split && stage.animationFrames !== animationFrames) {
      changes.push({
        path: `${ref.stage}.animationFrames`,
        before: stage.animationFrames,
        after: animationFrames,
      })
      stage.animationFrames = animationFrames
    }

    const hits = byStage[i] ?? []
    const damage = stage.damage ?? []
    const n = Math.min(hits.length, damage.length)
    for (let k = 0; k < n; k++) {
      // Split-stage hits land in the frozen animation → actionFrame 0.
      const actionFrame = split ? 0 : hits[k].frame - sec.start
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
 * Layout breaks independent of width, to match the authored files: the `variants`
 * map always breaks, and a `buffs` object with 3+ keys breaks. Propagates, so a
 * container can't inline a descendant that must break.
 */
function mustBreak(value: unknown, inBuffs: boolean): boolean {
  if (Array.isArray(value)) return value.some((v) => mustBreak(v, inBuffs))
  if (typeof value === "object" && value !== null) {
    const entries = objectEntries(value)
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
