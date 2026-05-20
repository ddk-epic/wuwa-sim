import type {
  ActionEvent,
  HitEvent,
  SimulationLogEntry,
} from "#/types/simulation-log"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "#/lib/catalog"
import { findStageByEntry, resolveStageExecution } from "./stage"

const EMPTY_SLOTS: Slots = [null, null, null]
const EMPTY_LOADOUTS: SlotLoadout[] = []

export interface TimelineSummaryRow {
  timeFrames: number
  durationFrames: number
  reactFrames: number
  padFrames: number
  damage: number | null
}

export interface TimelineSummary {
  rows: TimelineSummaryRow[]
  totalDamage: number
  totalTimeFrames: number
  dps: number
}

function fallbackReactFrames(
  entry: TimelineEntry,
  stage: { variants?: Partial<Record<string, unknown>> },
  reactionDelay: number,
): number {
  const vk = entry.variantKind
  if (!vk) return 0
  if (vk === "swap")
    return stage.variants?.swap !== undefined ? reactionDelay : 0
  return stage.variants?.[vk] !== undefined ? reactionDelay : 0
}

export function getTimelineSummary(
  entries: TimelineEntry[],
  slots: Slots = EMPTY_SLOTS,
  loadouts: SlotLoadout[] = EMPTY_LOADOUTS,
  reactionDelay = 9,
  swapFrames = 6,
  log?: SimulationLogEntry[],
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
          (hitDamageByEntryId.get(e.sourceEntryId) ?? 0) +
            (e as HitEvent).damage,
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
    let padFrames: number
    let damage: number | null

    if (ae !== undefined) {
      timeFrames = ae.frame
      reactFrames = ae.delayBreakdown?.react ?? 0
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
          )
        : null

      durationFrames = execution?.advance ?? 0
      reactFrames = resolved
        ? fallbackReactFrames(entry, resolved.stage, reactionDelay)
        : 0
      padFrames = 0

      if (execution && execution.hits.length > 0) {
        const multiplier = execution.hits.reduce((sum, d) => sum + d.value, 0)
        if (multiplier > 0) {
          const maxAtk = getCharacterById(entry.characterId)?.stats.max.atk ?? 0
          damage = Math.round(multiplier * maxAtk)
        } else {
          damage = null
        }
      } else {
        damage = null
      }
    }

    cumulativeFrames += durationFrames
    if (damage !== null) totalDamage += damage
    rows.push({ timeFrames, durationFrames, reactFrames, padFrames, damage })
  }

  const totalTimeFrames = rows.reduce((s, r) => s + r.durationFrames, 0)
  const dps =
    totalTimeFrames > 0 ? Math.round(totalDamage / (totalTimeFrames / 60)) : 0

  return { rows, totalDamage, totalTimeFrames, dps }
}
