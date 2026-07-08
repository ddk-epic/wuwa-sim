import { clipDisplayName } from "./clip"
import type { ForteClip } from "./clip"
import { reconcileForte } from "./reconcile"

/**
 * One clip's headline reading, calibration-normalized. `readings` are the
 * per-repeat forte values; `percent` is the average as a share of `forteCap`.
 * A holder for hand differencing until the Phase 2 solver lands.
 */
export interface ForteSummaryRow {
  clipId: string
  name: string
  measured: boolean
  readings: number[]
  average: number
  percent: number
  spread: number
}

export function forteSummaryRows(
  clips: ForteClip[],
  forteCap: number,
): ForteSummaryRow[] {
  return clips.map((clip) => {
    const base = { clipId: clip.id, name: clipDisplayName(clip) }
    const r = reconcileForte(clip, forteCap)
    if (r.status !== "measured")
      return {
        ...base,
        measured: false,
        readings: [],
        average: 0,
        percent: 0,
        spread: 0,
      }
    return {
      ...base,
      measured: true,
      readings: r.observations.map((o) => o.gain),
      average: r.mean,
      percent: (r.mean / forteCap) * 100,
      spread: r.spread,
    }
  })
}

const pct = (v: number) => v.toFixed(2)

/** Tab-separated for pasting into a sheet, where the hand differencing happens. */
export function summaryToText(
  rows: ForteSummaryRow[],
  forteCap: number,
): string {
  const width = Math.max(0, ...rows.map((r) => r.readings.length))
  const cols = Array.from({ length: width }, (_, i) => String(i + 1))
  const header = ["Action", ...cols, "avg %", "forte", "± err"]
  const lines = [header.join("\t")]
  for (const row of rows) {
    if (!row.measured) {
      lines.push(
        [row.name, ...Array(width).fill(""), "unmeasured", "", ""].join("\t"),
      )
      continue
    }
    const reads = row.readings.map((g) => pct((g / forteCap) * 100))
    while (reads.length < width) reads.push("")
    lines.push(
      [
        row.name,
        ...reads,
        pct(row.percent),
        pct(row.average),
        pct(row.spread),
      ].join("\t"),
    )
  }
  return lines.join("\n")
}
