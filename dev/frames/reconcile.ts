import { sections, stageTiming } from "./clip"
import { isPlaceholder } from "./stage-ref"
import type { Clip, CueTag } from "./clip"

/** One clip's reading of a stage's `actionTime`, tagged with the cue bounding it. */
export interface Observation {
  clipId: string
  value: number
  cue: CueTag
}

/** Per-stage corroboration. `unmeasured` is the absent case — see `statusOf`. */
export type StageStatus =
  | { status: "unmeasured" }
  | { status: "single"; actionTime: number; observations: Observation[] }
  | { status: "confirmed"; actionTime: number; observations: Observation[] }
  | {
      status: "conflict"
      estimate: number
      spread: number
      observations: Observation[]
    }

/** Cross-clip cross-check, keyed by stage id. A stage absent from the map is `unmeasured`. */
export type Reconciliation = Map<string, StageStatus>

// Frames agree within this band — eyeballing is ±1 even on a clean flash.
const TOLERANCE = 1

// Higher trust wins a cross-trust disagreement; only a same-trust spread conflicts.
const CUE_TRUST: Record<CueTag, number> = {
  impactFlash: 3,
  vfxEdge: 2,
  animationBreak: 1,
  estimate: 0,
}

/**
 * The cue bounding a stage's span — the weaker of its two dividers. A side that's
 * a clip endpoint (no divider) is the sentinel-pinned natural start/end, taken as
 * fully trusted so it never drags the reading's trust down.
 */
function boundingCue(clip: Clip, i: number): CueTag {
  const cues: CueTag[] = []
  if (i > 0) cues.push(clip.boundaries[i - 1].cue)
  if (i < clip.boundaries.length) cues.push(clip.boundaries[i].cue)
  if (cues.length === 0) return "impactFlash"
  return cues.reduce((w, c) => (CUE_TRUST[c] < CUE_TRUST[w] ? c : w))
}

/** Middle reading of a set — an actual value, never an average. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

function classify(obs: Observation[]): StageStatus {
  if (obs.length === 1)
    return { status: "single", actionTime: obs[0].value, observations: obs }

  const topTrust = Math.max(...obs.map((o) => CUE_TRUST[o.cue]))
  const top = obs.filter((o) => CUE_TRUST[o.cue] === topTrust)

  if (top.length >= 2) {
    const values = top.map((o) => o.value)
    const spread = Math.max(...values) - Math.min(...values)
    if (spread > TOLERANCE)
      return {
        status: "conflict",
        estimate: median(values),
        spread,
        observations: obs,
      }
    return {
      status: "confirmed",
      actionTime: median(values),
      observations: obs,
    }
  }

  // One top-trust reading wins outright; a lower-trust reading within tolerance
  // corroborates it, otherwise it stands alone over subordinate noise.
  const lead = top[0].value
  const corroborated = obs.some(
    (o) => o !== top[0] && Math.abs(o.value - lead) <= TOLERANCE,
  )
  return {
    status: corroborated ? "confirmed" : "single",
    actionTime: lead,
    observations: obs,
  }
}

/**
 * A cross-clip discrepancy checker, not a solve. Every clip already carries all
 * its interior dividers, so each stage in it yields a direct `actionTime` reading;
 * this groups those by stage id and reports how well they agree. It invents and
 * averages nothing — a same-trust disagreement surfaces as a `conflict` to
 * re-count. Placeholders and repeated occurrences past the first are skipped.
 */
export function reconcile(clips: Clip[]): Reconciliation {
  const byStage = new Map<string, Observation[]>()
  for (const clip of clips) {
    const secs = sections(clip)
    const seen = new Set<string>()
    clip.stageRefs.forEach((ref, i) => {
      if (isPlaceholder(ref) || seen.has(ref.id)) return
      seen.add(ref.id)
      const value = stageTiming(clip, i, secs).actionTime
      const list = byStage.get(ref.id) ?? []
      list.push({ clipId: clip.id, value, cue: boundingCue(clip, i) })
      byStage.set(ref.id, list)
    })
  }
  const result: Reconciliation = new Map()
  for (const [id, obs] of byStage) result.set(id, classify(obs))
  return result
}

/** A stage's status, defaulting to `unmeasured` when no clip has touched it. */
export function statusOf(recon: Reconciliation, id: string): StageStatus {
  return recon.get(id) ?? { status: "unmeasured" }
}
