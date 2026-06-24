import {
  animationSplitOf,
  hitsByStage,
  isPlaceholder,
  sections,
  stageTiming,
} from "./types"
import type { Clip, StageRef } from "./types"
import { statusOf } from "./reconcile"
import type { Reconciliation, StageStatus } from "./reconcile"

/** A best-clip hit projected to its `actionFrame` — uncapped; readers apply capacity. */
export interface HitProjection {
  actionFrame: number
}

/** Every cross-clip answer a stage needs beyond `actionTime`, read off its best clip. */
export interface StageProjection {
  status: StageStatus
  best: { clipId: string; index: number } | null
  hits: HitProjection[]
  animationFrames: number | null
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
 * occurrence — with that occurrence's index. Null when no clip contains it.
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

function projectStage(
  clips: Clip[],
  stageId: string,
  recon: Reconciliation,
): StageProjection {
  const status = statusOf(recon, stageId)
  const best = bestClipFor(clips, stageId)
  if (!best) return { status, best: null, hits: [], animationFrames: null }

  const secs = sections(best.clip)
  const sec = secs[best.index]
  const split = animationSplitOf(best.clip, best.index)
  const animationFrames = split
    ? stageTiming(best.clip, best.index, secs).animationFrames
    : null
  const hits = (hitsByStage(best.clip)[best.index] ?? []).map((h) => ({
    actionFrame: split ? 0 : h.frame - sec.start,
  }))
  return {
    status,
    best: { clipId: best.clip.id, index: best.index },
    hits,
    animationFrames,
  }
}

/**
 * Cross-clip stage projection, keyed by stage id. Composes the reconciler (it
 * never re-derives `actionTime`) and answers every other cross-clip question off
 * each stage's best clip: hits as `actionFrame`s and the animation-split slice.
 */
export function projectStages(
  clips: Clip[],
  recon: Reconciliation,
): Map<string, StageProjection> {
  const map = new Map<string, StageProjection>()
  for (const ref of collectStageRefs(clips))
    map.set(ref.id, projectStage(clips, ref.id, recon))
  return map
}

/** A stage's projection, defaulting to `unmeasured`/empty when no clip touched it. */
export function projectionOf(
  map: Map<string, StageProjection>,
  id: string,
): StageProjection {
  return (
    map.get(id) ?? {
      status: { status: "unmeasured" },
      best: null,
      hits: [],
      animationFrames: null,
    }
  )
}
