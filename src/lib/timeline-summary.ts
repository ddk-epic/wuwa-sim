import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "#/lib/catalog"
import { findStageByEntry, resolveStageExecution } from "./stage"

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
    let rowDamage: number | null = null

    const resolved = findStageByEntry(entry, slots, loadouts)
    const execution = resolved
      ? resolveStageExecution(resolved.stage, entry.variantKind, reactionDelay)
      : null

    cumulativeFrames += execution?.advance ?? 0

    // TODO: replace estimate with log-derived damage once swap-aware attribution exists; frame-window grouping breaks when a swapped-out character's DoTs tick during the next action.
    if (execution && execution.hits.length > 0) {
      const multiplier = execution.hits.reduce((sum, d) => sum + d.value, 0)
      if (multiplier > 0) {
        const maxAtk = getCharacterById(entry.characterId)?.stats.max.atk ?? 0
        rowDamage = Math.round(multiplier * maxAtk)
        totalDamage += rowDamage
      }
    }

    rows.push({ time, damage: rowDamage })
  }

  const totalTimeSec = cumulativeFrames / FRAMES_PER_SECOND
  const dps = totalTimeSec > 0 ? Math.round(totalDamage / totalTimeSec) : 0

  return { rows, totalDamage, totalTimeSec, dps }
}
