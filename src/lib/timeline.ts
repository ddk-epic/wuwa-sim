import type { TimelineEntry } from '#/types/timeline'

export function accumulateTime(entries: TimelineEntry[]): number[] {
  const times: number[] = []
  let cumulative = 0
  for (const entry of entries) {
    times.push(cumulative)
    cumulative += entry.actionTime
  }
  return times
}

export function computeDamage(multiplier: number, maxAtk: number): number {
  return Math.round(multiplier * maxAtk)
}
