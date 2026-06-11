import type {
  DamageEntry,
  Footing,
  SkillType,
  VariantKind,
} from "#/types/character"
import type { TimelineEntry } from "#/types/timeline"
import type { ResolvedStage } from "./stage"

/**
 * One scheduled hit of a stage, carrying everything needed to resolve it at its
 * `hitFrame`. A swap stage's hits whose `actionFrame` exceeds the stage's
 * `advance` become trailing members of the pending stream; other hits resolve
 * immediately. The Acting Character is always the bundle's `entry.characterId`.
 */
export interface TrailingHit {
  hit: DamageEntry
  hitIndex: number
  stageStartFrame: number
  entry: TimelineEntry
  resolved: ResolvedStage
  hitFrame: number
}

const CANCEL_CAPABLE = new Set<SkillType>([
  "Resonance Skill",
  "Resonance Liberation",
  "Intro Skill",
  "Outro Skill",
  "Echo Skill",
])

/**
 * Whether a re-entry of this Skill Type cancels a same-character stage's residual
 * trailing hits (drop) versus padding to let them all land.
 */
export function isCancelCapable(skillType: SkillType): boolean {
  return CANCEL_CAPABLE.has(skillType)
}

/**
 * A scheduled footing flip a swap stage carries onto its owner. `commit` is the
 * launch/land flip at the commit frame; `reset` is the window-end return to
 * ground that always accompanies a launch (the Trailing Window lasts exactly the
 * stage's `actionTime`, per CONTEXT.md). A `reset` only ever appears alongside a
 * launch `commit`, so the air-only gate is structural — callers never test it.
 */
export interface FootingChange {
  atFrame: number
  exitFooting: "ground" | "air"
  kind: "commit" | "reset"
}

export interface StagePartition {
  /** Hits that resolve within the cursor advance — fired now, in order. */
  immediate: readonly TrailingHit[]
  /** Swap-stage hits landing after the advance — enqueued onto the stream. */
  trailing: readonly TrailingHit[]
  /** Swap-stage launch/land commits and the window-end reset, after the advance. */
  footingChanges: readonly FootingChange[]
}

/**
 * Partition a stage's hits into immediate vs trailing and surface any deferred
 * footing commit. For a non-swap stage every hit is immediate (no trailing window
 * opens).
 */
export function partitionStage(ctx: {
  entry: TimelineEntry
  resolved: ResolvedStage
  stageStartFrame: number
  hits: readonly DamageEntry[]
  variantKind: VariantKind | undefined
  stageDuration: number
}): StagePartition {
  const allBundles: TrailingHit[] = ctx.hits.map((h, i) => ({
    hit: h,
    hitIndex: i,
    stageStartFrame: ctx.stageStartFrame,
    entry: ctx.entry,
    resolved: ctx.resolved,
    hitFrame: ctx.stageStartFrame + h.actionFrame,
  }))

  // Post-actionTime hits defer for every stage, so a later earlier-framed cast
  // interleaves ahead of them rather than the clock racing past it.
  const isSwap = ctx.variantKind === "swap"
  const immediate = allBundles.filter(
    (b) => b.hit.actionFrame <= ctx.stageDuration,
  )
  const trailing = allBundles.filter(
    (b) => b.hit.actionFrame > ctx.stageDuration,
  )

  const footingChanges = isSwap
    ? buildFootingChanges(
        ctx.resolved.stage.footing,
        ctx.stageStartFrame,
        ctx.resolved.stage.actionTime,
      )
    : []

  return { immediate, trailing, footingChanges }
}

/**
 * Plan the footing flips a swap stage carries onto its owner. A launch flips the
 * owner's carried footing to `air` at the launch frame and schedules its own
 * window-end `reset` to ground at `stageStart + actionTime` (the Trailing
 * Window's duration); a land carries `ground` at the land frame with no reset.
 *
 * This fires for **every** swap launch/land, not only those whose commit frame
 * lands after the variant advance. The commit is owner bookkeeping (facet 2 in
 * `references/footing.md`): it is what the owner resumes on a swap-back during its
 * trailing window, and what the window-end reset later clears. It cannot depend on
 * whether the commit frame fell before or after the advance — those few frames
 * only decide what a *fresh swap-in* inherits, which is the field-footing flip
 * `FootingModule.applyStageFooting` already handles for the on-field case. (Were
 * the carry gated on `commit > advance`, an early in-stage launch would flip the
 * field but never carry on its owner, so a swap-back after a teammate grounded the
 * field would wrongly land that owner on the ground.)
 *
 * The reset frame uses the raw stage `actionTime`, not the variant advance — the
 * two are not interchangeable.
 */
function buildFootingChanges(
  footing: Footing | undefined,
  stageStartFrame: number,
  actionTime: number,
): FootingChange[] {
  if (!footing || typeof footing !== "object") return []
  if ("launch" in footing) {
    return [
      {
        atFrame: stageStartFrame + footing.launch,
        exitFooting: "air",
        kind: "commit",
      },
      {
        atFrame: stageStartFrame + actionTime,
        exitFooting: "ground",
        kind: "reset",
      },
    ]
  }
  if ("land" in footing) {
    return [
      {
        atFrame: stageStartFrame + footing.land,
        exitFooting: "ground",
        kind: "commit",
      },
    ]
  }
  return []
}
