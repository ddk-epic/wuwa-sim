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
 * A scheduled footing flip for a swap stage. `commit` is the launch/land flip
 * that lands after the cursor advance; `reset` is the window-end return to
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

  const isSwap = ctx.variantKind === "swap"
  const immediate = isSwap
    ? allBundles.filter((b) => b.hit.actionFrame <= ctx.stageDuration)
    : allBundles
  const trailing = isSwap
    ? allBundles.filter((b) => b.hit.actionFrame > ctx.stageDuration)
    : []

  const footingChanges = isSwap
    ? buildFootingChanges(
        ctx.resolved.stage.footing,
        ctx.stageStartFrame,
        ctx.stageDuration,
        ctx.resolved.stage.actionTime,
      )
    : []

  return { immediate, trailing, footingChanges }
}

/**
 * Plan the footing flips a swap stage commits after its cursor advance. A launch
 * past the advance flips to `air` at the launch frame and schedules its own
 * window-end `reset` to ground at `stageStart + actionTime` (the Trailing
 * Window's duration). A land past the advance flips to `ground` at the land
 * frame with no reset. The launch/land gate uses `stageDuration` (the variant's
 * `advance`); the reset frame uses the raw stage `actionTime` — the two are not
 * interchangeable.
 */
function buildFootingChanges(
  footing: Footing | undefined,
  stageStartFrame: number,
  stageDuration: number,
  actionTime: number,
): FootingChange[] {
  if (!footing || typeof footing !== "object") return []
  if ("launch" in footing && footing.launch > stageDuration) {
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
  if ("land" in footing && footing.land > stageDuration) {
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
