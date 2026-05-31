import type { TimelineSummaryRow } from "./timeline-summary"

/**
 * A Timeline Group's flat span within the Timeline Summary's `rows`. Produced by
 * the render-item builder (which already computes these indices); reused here so
 * flat-range arithmetic lives in exactly one place.
 */
export interface GroupSpan {
  groupId: string
  startFlatIndex: number
  entryCount: number
}

/**
 * A Timeline Group's rolled-up totals. A **view-layer derivation** of the flat
 * Timeline Summary — groups are visual-only (ADR-0016) and never reach the
 * engine, so this is computed beside the summary, not as a field on it.
 *
 * `totalDamage` is `null` when no row in the group carried damage (no sim run),
 * distinct from a real sum of `0`.
 */
export interface GroupSummary {
  totalDamage: number | null
  totalDurationFrames: number
  startTimeFrames: number
  endConcerto: number | null
  endEnergy: number | null
}

/** Roll the flat summary rows up into per-group totals, keyed by group id. */
export function summarizeGroups(
  rows: readonly TimelineSummaryRow[],
  spans: readonly GroupSpan[],
): Map<string, GroupSummary> {
  const result = new Map<string, GroupSummary>()
  for (const { groupId, startFlatIndex, entryCount } of spans) {
    let totalDurationFrames = 0
    let damageSum = 0
    let hasDamage = false
    for (let i = 0; i < entryCount; i++) {
      const row = rows[startFlatIndex + i]
      totalDurationFrames += row.durationFrames
      if (row.damage !== null) {
        damageSum += row.damage
        hasDamage = true
      }
    }
    const firstRow = entryCount > 0 ? rows[startFlatIndex] : undefined
    const lastRow =
      entryCount > 0 ? rows[startFlatIndex + entryCount - 1] : undefined
    result.set(groupId, {
      totalDamage: hasDamage ? damageSum : null,
      totalDurationFrames,
      startTimeFrames: firstRow?.timeFrames ?? 0,
      endConcerto: lastRow?.cumulativeConcerto ?? null,
      endEnergy: lastRow?.cumulativeEnergy ?? null,
    })
  }
  return result
}
