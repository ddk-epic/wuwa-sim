import type {
  EnrichedCharacter,
  EnrichedSkillAttribute,
  StageVariant,
} from "#/types/character"
import {
  hitsByStage,
  isPlaceholder,
  resolveVariantTarget,
  sections,
  stageTiming,
} from "./types"
import type { Clip, StageRef, VariantTarget, VariantTrack } from "./types"
import { statusOf } from "./reconcile"
import type { Reconciliation } from "./reconcile"

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

/** Every non-placeholder stage measured in ≥1 clip, deduped by id, first appearance first. */
function collectStageRefs(clips: Clip[]): StageRef[] {
  const seen = new Map<string, StageRef>()
  for (const clip of clips)
    for (const ref of clip.stageRefs)
      if (!isPlaceholder(ref) && !seen.has(ref.id)) seen.set(ref.id, ref)
  return [...seen.values()]
}

/**
 * The clip that measures a stage most completely — most hits on its first
 * occurrence — with that occurrence's index. Drives hits, split, and variant
 * resolution; null when no clip contains the stage.
 */
function bestClipFor(
  clips: Clip[],
  stageId: string,
): { clip: Clip; index: number } | null {
  let best: { clip: Clip; index: number; hits: number } | null = null
  for (const clip of clips) {
    const index = clip.stageRefs.findIndex((r) => r.id === stageId)
    if (index === -1) continue
    const hits = hitsByStage(clip)[index]?.length ?? 0
    if (!best || hits > best.hits) best = { clip, index, hits }
  }
  return best && { clip: best.clip, index: best.index }
}

/** The track's authored target in every clip that pins it (stage's first occurrence). */
function collectTargets(
  clips: Clip[],
  stageId: string,
  track: VariantTrack,
): VariantTarget[] {
  const out: VariantTarget[] = []
  for (const clip of clips) {
    const i = clip.stageRefs.findIndex((r) => r.id === stageId)
    if (i === -1) continue
    const t = clip.variants?.[i]?.[track]
    if (t) out.push(t)
  }
  return out
}

const sameTarget = (a: VariantTarget, b: VariantTarget): boolean =>
  a.kind === b.kind && (a.kind !== "hit" || a.n === (b as { n: number }).n)

/**
 * Re-key a stage so `animationFrames` follows `actionTime` — a fresh assignment
 * appends it last. Idempotent when it's already in place.
 */
function orderAnimationFrames(
  stage: EnrichedSkillAttribute,
): EnrichedSkillAttribute {
  if (stage.animationFrames === undefined) return stage
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(stage)) {
    if (k === "animationFrames") continue
    out[k] = v
    if (k === "actionTime") out.animationFrames = stage.animationFrames
  }
  return out as EnrichedSkillAttribute
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
 * Clone the character and sparse-patch only what was measured, leaving the rest
 * byte-equal so the diff stays tight. Character-scoped across the whole clip set:
 * `actionTime` comes from the reconciler, and each stage's hits, split, and
 * variant resolution come from its best clip (the one with the most hits). A
 * `conflict` actionTime, a missing cutscene split, or a cross-clip variant
 * disagreement is skipped with a warning rather than guessed.
 */
export function buildExport(
  char: EnrichedCharacter,
  clips: Clip[],
  recon: Reconciliation,
): ExportResult {
  const patched = structuredClone(char)
  const changes: Change[] = []
  const warnings: string[] = []

  for (const ref of collectStageRefs(clips)) {
    const stage = locateStage(patched, ref)
    if (!stage) {
      warnings.push(`${ref.stage} not found in the registry — skipped.`)
      continue
    }

    const best = bestClipFor(clips, ref.id)
    const split = best
      ? (best.clip.animationSplits?.[best.index] ?? null)
      : null
    const status = statusOf(recon, ref.id)
    // A cutscene's section width is all frozen animation until split apart; its
    // actionTime is meaningless without the split.
    const expectsSplit = (stage.animationFrames ?? 0) > 0
    if (expectsSplit && !split) {
      warnings.push(
        `${ref.stage} expects an animation split — place one before pasting; actionTime skipped.`,
      )
    } else if (status.status === "conflict") {
      const values = [...new Set(status.observations.map((o) => o.value))].sort(
        (a, b) => a - b,
      )
      warnings.push(
        `${ref.stage}: clips disagree (${values.join(" vs ")}) — re-count before pasting.`,
      )
    } else if (status.status === "single" || status.status === "confirmed") {
      if (stage.actionTime !== status.actionTime) {
        changes.push({
          path: `${ref.stage}.actionTime`,
          before: stage.actionTime,
          after: status.actionTime,
        })
        stage.actionTime = status.actionTime
      }
    }

    if (!best) continue
    const secs = sections(best.clip)
    const sec = secs[best.index]

    if (split) {
      const { animationFrames } = stageTiming(best.clip, best.index, secs)
      if (stage.animationFrames !== animationFrames) {
        changes.push({
          path: `${ref.stage}.animationFrames`,
          before: stage.animationFrames,
          after: animationFrames,
        })
        stage.animationFrames = animationFrames
      }
    }

    const hits = hitsByStage(best.clip)[best.index] ?? []
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

    for (const track of ["cancel", "swap"] as const) {
      const targets = collectTargets(clips, ref.id, track)
      if (targets.length === 0) continue
      if (!targets.every((t) => sameTarget(t, targets[0]))) {
        warnings.push(
          `${ref.stage} ${track}: clips disagree on the pin — reconcile before pasting.`,
        )
        continue
      }
      const target = targets[0]
      const resolved = resolveVariantTarget(best.clip, best.index, target)
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
  }

  for (const skill of patched.skills)
    skill.stages = skill.stages.map(orderAnimationFrames)

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
