import type {
  ActionEvent,
  DelayBreakdown,
  SimulationLogEntry,
} from "#/types/simulation-log"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { findStageByEntry } from "../compile-character"
import { resolveStageExecution } from "../stage"

const EMPTY_SLOTS: Slots = [null, null, null]
const EMPTY_LOADOUTS: SlotLoadout[] = []
const ZERO_DELAY: DelayBreakdown = {
  pad: { reaction: 0, floor: 0, trailing: 0, fall: 0 },
  wait: 0,
}

export interface TimelineSummaryRow {
  timeFrames: number
  durationFrames: number
  delay: DelayBreakdown
  damage: number | null
  cumulativeConcerto: number | null
  cumulativeEnergy: number | null
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
  const lastHitConcertoByEntryId = new Map<string, number>()
  const lastHitEnergyByEntryId = new Map<string, number>()

  const entryCharById = new Map<string, number>()
  for (const entry of entries) entryCharById.set(entry.id, entry.characterId)

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
        if (e.characterId === entryCharById.get(e.sourceEntryId)) {
          lastHitConcertoByEntryId.set(e.sourceEntryId, e.cumulativeConcerto)
          lastHitEnergyByEntryId.set(e.sourceEntryId, e.cumulativeEnergy)
        }
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
    let delay: DelayBreakdown
    let damage: number | null
    let cumulativeConcerto: number | null
    let cumulativeEnergy: number | null
    // Wait owned by the NEXT entry but living in this row's gap — kept out of the
    // displayed duration, added back into the real clock below.
    let waitNext = 0

    if (ae !== undefined) {
      timeFrames = ae.frame
      delay = ae.delayBreakdown ?? ZERO_DELAY

      if (nextAe !== undefined) {
        waitNext = nextAe.delayBreakdown?.wait ?? 0
        durationFrames = nextAe.frame - ae.frame - waitNext
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
      cumulativeConcerto =
        lastHitConcertoByEntryId.get(entry.id) ?? ae.cumulativeConcerto
      cumulativeEnergy =
        lastHitEnergyByEntryId.get(entry.id) ?? ae.cumulativeEnergy
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
      delay = {
        pad: {
          reaction: execution?.react ?? 0,
          floor: execution?.floor ?? 0,
          trailing: 0,
          fall: 0,
        },
        wait: 0,
      }
      damage = null
      cumulativeConcerto = null
      cumulativeEnergy = null
    }

    cumulativeFrames += durationFrames + waitNext
    if (damage !== null) totalDamage += damage
    rows.push({
      timeFrames,
      durationFrames,
      delay,
      damage,
      cumulativeConcerto,
      cumulativeEnergy,
    })
  }

  const totalTimeFrames = cumulativeFrames
  const dps =
    totalTimeFrames > 0 ? Math.round(totalDamage / (totalTimeFrames / 60)) : 0

  return { rows, totalDamage, totalTimeFrames, dps }
}
