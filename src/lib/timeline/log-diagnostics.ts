import type { Diagnostic, SimulationLogEntry } from "#/types/simulation-log"

/**
 * Fold engine-emitted Diagnostics out of a Simulation Log, keyed by the
 * Timeline Entry that produced them. View-layer derivation: rows display these
 * alongside the validator's structural warnings, under the stale regime — they
 * describe the last run, not the current edit state. Findings are returned
 * structured; the render-items builder turns them into text via row-messages.
 */
export function deriveRowDiagnostics(
  log: SimulationLogEntry[],
): Map<string, Diagnostic[]> {
  const byEntry = new Map<string, Diagnostic[]>()
  for (const e of log) {
    if (e.kind !== "action" || !e.diagnostics || e.sourceEntryId === undefined)
      continue
    const existing = byEntry.get(e.sourceEntryId) ?? []
    existing.push(...e.diagnostics)
    byEntry.set(e.sourceEntryId, existing)
  }
  return byEntry
}
