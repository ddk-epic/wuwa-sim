import { fillFractionAt } from "./calibration"
import type { ForteClip, ForteSeparator } from "./clip"

/** One repeat's forte gain, credited to the separator that closed it. */
export interface ForteObservation {
  sepId: string
  owner: number
  gain: number
}

/**
 * A clip's per-repeat forte, averaged across its separators. Statistical, not
 * the timing tool's exact-agreement check: repeats are independent samples of
 * the same quantity, so they average with a spread. `unmeasured` below two
 * fenceposts (baseline plus at least one separator).
 */
export type ForteReading =
  | { status: "unmeasured" }
  | {
      status: "measured"
      mean: number
      spread: number
      observations: ForteObservation[]
    }

/** Separators in derivation order: by owner, then frame as a stable tiebreak. */
export function orderedSeparators(clip: ForteClip): ForteSeparator[] {
  return [...(clip.separators ?? [])].sort(
    (a, b) => a.owner - b.owner || a.frame - b.frame,
  )
}

// Consecutive-diff observations off the ordered fenceposts: baseline, then each
// separator's gauge level. Reads nothing derived, so it reflows on recalibrate.
function observe(clip: ForteClip, forteCap: number): ForteObservation[] {
  const cal = clip.calibration
  const seps = orderedSeparators(clip)
  let prev = clip.baseline ?? 0
  return seps.map((s) => {
    const level = cal ? fillFractionAt(cal, s.fill) : 0
    const gain = (level - prev) * forteCap
    prev = level
    return { sepId: s.id, owner: s.owner, gain }
  })
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

// Sample standard deviation; a lone reading has no spread. Variance-based so
// Phase 2's differencing can combine spreads by adding variances.
function spread(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const variance =
    xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

export function reconcileForte(
  clip: ForteClip,
  forteCap: number,
): ForteReading {
  const observations = observe(clip, forteCap)
  if (observations.length === 0) return { status: "unmeasured" }
  const gains = observations.map((o) => o.gain)
  return {
    status: "measured",
    mean: mean(gains),
    spread: spread(gains),
    observations,
  }
}
