import type {
  EnrichedCharacter,
  EnrichedSkillAttribute,
  StageVariant,
} from "#/types/character"
import { isPlaceholder } from "./clip"
import type { Clip, StageRef, VariantTrack } from "./clip"
import { projectionOf } from "./projection"
import type { StageProjection } from "./projection"
import { characterToTs } from "./character-ts"

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
  projections: Map<string, StageProjection>,
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

    const projection = projectionOf(projections, ref.id)
    const { status } = projection
    const hasSplit = projection.animationFrames !== null
    // A cutscene's section width is all frozen animation until split apart; its
    // actionTime is meaningless without the split.
    const expectsSplit = (stage.animationFrames ?? 0) > 0
    if (expectsSplit && !hasSplit) {
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

    if (!projection.best) continue

    if (projection.animationFrames !== null) {
      if (stage.animationFrames !== projection.animationFrames) {
        changes.push({
          path: `${ref.stage}.animationFrames`,
          before: stage.animationFrames,
          after: projection.animationFrames,
        })
        stage.animationFrames = projection.animationFrames
      }
    }

    const damage = stage.damage ?? []
    const n = Math.min(projection.hits.length, damage.length)
    for (let k = 0; k < n; k++) {
      const { actionFrame } = projection.hits[k]
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
      const tp = projection.variants[track]
      if (!tp) continue
      if (!tp.agreed) {
        warnings.push(
          `${ref.stage} ${track}: clips disagree on the pin — reconcile before pasting.`,
        )
        continue
      }
      const { target, resolution } = tp
      if (!resolution.ok) {
        warnings.push(
          `${ref.stage} ${track} unresolved — ${resolution.reason}.`,
        )
        continue
      }
      const key = variantKeyFor(track, target)
      const value: StageVariant = { actionTime: resolution.actionTime }
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
