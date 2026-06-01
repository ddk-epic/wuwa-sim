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
 * `advance` become trailing members of the frame-ordered pending stream
 * (ADR-0018, relocated off a per-character map onto the stream in ADR-0028's
 * endgame); other hits resolve immediately. The Acting Character is always the
 * bundle's `entry.characterId`.
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
 * Whether a re-entry of this Skill Type cancels a same-character stage's
 * residual trailing hits (drop) versus padding to let them all land (ADR-0018).
 */
export function isCancelCapable(skillType: SkillType): boolean {
  return CANCEL_CAPABLE.has(skillType)
}

export interface StagePartition {
  /** Hits that resolve within the cursor advance — fired now, in order. */
  immediate: readonly TrailingHit[]
  /** Swap-stage hits landing after the advance — enqueued onto the stream. */
  trailing: readonly TrailingHit[]
  /** A swap-stage launch/land whose commit frame falls after the advance. */
  pendingFooting?: { atFrame: number; exitFooting: "ground" | "air" }
}

/**
 * Partition a stage's hits into immediate vs trailing and surface any deferred
 * footing commit. Pure: it computes frames from the stage's own data, holding no
 * state — the caller enqueues the trailing hits and parks the footing commit.
 * For a non-swap stage every hit is immediate (no trailing window opens).
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

  const pendingFooting = isSwap
    ? buildPendingFooting(
        ctx.resolved.stage.footing,
        ctx.stageStartFrame,
        ctx.stageDuration,
      )
    : undefined

  return { immediate, trailing, pendingFooting }
}

function buildPendingFooting(
  footing: Footing | undefined,
  stageStartFrame: number,
  stageDuration: number,
): { atFrame: number; exitFooting: "ground" | "air" } | undefined {
  if (!footing || typeof footing !== "object") return undefined
  if ("launch" in footing && footing.launch > stageDuration) {
    return { atFrame: stageStartFrame + footing.launch, exitFooting: "air" }
  }
  if ("land" in footing && footing.land > stageDuration) {
    return { atFrame: stageStartFrame + footing.land, exitFooting: "ground" }
  }
  return undefined
}
