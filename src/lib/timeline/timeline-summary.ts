import type { ActionEvent, SimulationLogEntry } from "#/types/simulation-log"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { findStageByEntry, resolveStageExecution } from "../stage/stage"

const EMPTY_SLOTS: Slots = [null, null, null]
const EMPTY_LOADOUTS: SlotLoadout[] = []

export interface TimelineSummaryRow {
  timeFrames: number
  durationFrames: number
  reactFrames: number
  floorFrames: number
  padFrames: number
  damage: number | null
}

export interface TimelineSummary {
  rows: TimelineSummaryRow[]
  totalDamage: number
  totalTimeFrames: number
  dps: number
}

export function getTimelineSummary(
  entries: TimelineEntry[],
  slots: Slots = EMPTY_SLOTS,
  loadouts: SlotLoadout[] = EMPTY_LOADOUTS,
  reactionDelay = 9,
  swapFrames = 6,
  log?: SimulationLogEntry[],
  variantFloor = 0,
): TimelineSummary {
  const logActionEvents: ActionEvent[] = []
  const actionIdxByEntryId = new Map<string, number>()
  const hitDamageByEntryId = new Map<string, number>()

  if (log) {
    for (const e of log) {
      if (e.kind === "action") {
        const idx = logActionEvents.length
        logActionEvents.push(e)
        if (e.sourceEntryId) actionIdxByEntryId.set(e.sourceEntryId, idx)
      } else if (e.kind === "hit" && e.sourceEntryId !== undefined) {
        hitDamageByEntryId.set(
          e.sourceEntryId,
          (hitDamageByEntryId.get(e.sourceEntryId) ?? 0) + e.damage,
        )
      }
    }
  }

  const rows: TimelineSummaryRow[] = []
  let cumulativeFrames = 0
  let totalDamage = 0

  for (const entry of entries) {
    const logIdx = actionIdxByEntryId.get(entry.id)
    const ae = logIdx !== undefined ? logActionEvents[logIdx] : undefined
    const nextAe =
      logIdx !== undefined ? logActionEvents[logIdx + 1] : undefined

    let timeFrames: number
    let durationFrames: number
    let reactFrames: number
    let floorFrames: number
    let padFrames: number
    let damage: number | null

    if (ae !== undefined) {
      timeFrames = ae.frame
      reactFrames = ae.delayBreakdown?.react ?? 0
      floorFrames = ae.delayBreakdown?.floor ?? 0
      padFrames = ae.delayBreakdown?.pad ?? 0

      if (nextAe !== undefined) {
        durationFrames = nextAe.frame - ae.frame
      } else {
        const resolved = findStageByEntry(entry, slots, loadouts)
        durationFrames = resolved
          ? resolveStageExecution(
              resolved.stage,
              entry.variantKind,
              reactionDelay,
              swapFrames,
              variantFloor,
            ).advance
          : 0
      }

      const dmg = hitDamageByEntryId.get(entry.id)
      damage = dmg !== undefined ? dmg : null
    } else {
      timeFrames = cumulativeFrames

      const resolved = findStageByEntry(entry, slots, loadouts)
      const execution = resolved
        ? resolveStageExecution(
            resolved.stage,
            entry.variantKind,
            reactionDelay,
            swapFrames,
            variantFloor,
          )
        : null

      durationFrames = execution?.advance ?? 0
      reactFrames = execution?.react ?? 0
      floorFrames = execution?.floor ?? 0
      padFrames = 0
      damage = null
    }

    cumulativeFrames += durationFrames
    if (damage !== null) totalDamage += damage
    rows.push({
      timeFrames,
      durationFrames,
      reactFrames,
      floorFrames,
      padFrames,
      damage,
    })
  }

  const totalTimeFrames = rows.reduce((s, r) => s + r.durationFrames, 0)
  const dps =
    totalTimeFrames > 0 ? Math.round(totalDamage / (totalTimeFrames / 60)) : 0

  return { rows, totalDamage, totalTimeFrames, dps }
}
