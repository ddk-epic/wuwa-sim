import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "#/lib/catalog"

const FRAMES_PER_SECOND = 60

export interface TimelineSummaryRow {
  time: number
  damage: number | null
}

export interface TimelineSummary {
  rows: TimelineSummaryRow[]
  totalDamage: number
  totalTimeSec: number
  dps: number
}

export function getTimelineSummary(entries: TimelineEntry[]): TimelineSummary {
  const rows: TimelineSummaryRow[] = []
  let cumulativeFrames = 0
  let totalDamage = 0

  for (const entry of entries) {
    const time = cumulativeFrames / FRAMES_PER_SECOND
    let damage: number | null = null
    if (entry.multiplier > 0) {
      const maxAtk = getCharacterById(entry.characterId)?.stats.max.atk ?? 0
      damage = Math.round(entry.multiplier * maxAtk)
      totalDamage += damage
    }
    rows.push({ time, damage })
    cumulativeFrames += entry.actionTime
  }

  const totalTimeSec = cumulativeFrames / FRAMES_PER_SECOND
  const dps = totalTimeSec > 0 ? Math.round(totalDamage / totalTimeSec) : 0

  return { rows, totalDamage, totalTimeSec, dps }
}
