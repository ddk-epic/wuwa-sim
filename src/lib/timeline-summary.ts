import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "#/lib/catalog"
import { resolveStage, resolveStageExecution } from "./stage"

const FRAMES_PER_SECOND = 60

const EMPTY_SLOTS: Slots = [null, null, null]
const EMPTY_LOADOUTS: SlotLoadout[] = []

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

export function getTimelineSummary(
  entries: TimelineEntry[],
  slots: Slots = EMPTY_SLOTS,
  loadouts: SlotLoadout[] = EMPTY_LOADOUTS,
  reactionDelay: number = 9,
): TimelineSummary {
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

    const resolved = resolveStage(entry, slots, loadouts)
    cumulativeFrames += resolved
      ? resolveStageExecution(resolved.stage, entry.variantKind, reactionDelay)
          .duration
      : 0
  }

  const totalTimeSec = cumulativeFrames / FRAMES_PER_SECOND
  const dps = totalTimeSec > 0 ? Math.round(totalDamage / totalTimeSec) : 0

  return { rows, totalDamage, totalTimeSec, dps }
}
