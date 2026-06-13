import type { SimulationLogEntry } from "#/types/simulation-log"
import { renderMessage } from "./row-messages"
import type { ValidationWarning } from "./validate-timeline"

/**
 * Fold engine-emitted Diagnostics out of a Simulation Log, keyed by the
 * Timeline Entry that produced them. View-layer derivation: rows display these
 * alongside the validator's structural warnings, under the stale regime —
 * they describe the last run, not the current edit state.
 */
export function deriveRowDiagnostics(
  log: SimulationLogEntry[],
): Map<string, ValidationWarning[]> {
  const byEntry = new Map<string, ValidationWarning[]>()
  for (const e of log) {
    if (e.kind !== "action" || !e.diagnostics || e.sourceEntryId === undefined)
      continue
    const existing = byEntry.get(e.sourceEntryId) ?? []
    for (const d of e.diagnostics) existing.push({ message: renderMessage(d) })
    byEntry.set(e.sourceEntryId, existing)
  }
  return byEntry
}
