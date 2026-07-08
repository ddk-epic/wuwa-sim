import { fillFractionAt } from "./calibration"
import type { ForteClip } from "./clip"

/** One repeat's forte gain, credited to the slot (occurrence) that closed it. */
export interface ForteObservation {
  owner: number
  gain: number
}

/**
 * A clip's per-repeat forte, averaged across its measured slots. Statistical,
 * not the timing tool's exact-agreement check: repeats are independent samples
 * of the same quantity, so they average with a spread. `unmeasured` when no
 * slot carries a reading.
 */
export type ForteReading =
  | { status: "unmeasured" }
  | {
      status: "measured"
      mean: number
      spread: number
      observations: ForteObservation[]
    }

// Consecutive-diff observations off the sequence: a depleted (0) start, then
// each measured slot's gauge level. Reads nothing derived, so it reflows on
// recalibrate.
function observe(clip: ForteClip, forteCap: number): ForteObservation[] {
  const cal = clip.calibration
  let prev = 0
  const obs: ForteObservation[] = []
  clip.slots.forEach((slot, i) => {
    if (!slot.reading) return
    const level = cal ? fillFractionAt(cal, slot.reading) : 0
    obs.push({ owner: i, gain: (level - prev) * forteCap })
    prev = level
  })
  return obs
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
