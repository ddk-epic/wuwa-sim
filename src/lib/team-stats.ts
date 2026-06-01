import type { SimulationLogEntry } from "#/types/simulation-log"

/** One slice of the type-distribution pie: hit count and summed damage. */
export interface TypeEntry {
  count: number
  dmg: number
}

/**
 * Per-team aggregates folded from a Simulation Log — the figures the Library
 * needs that `getTimelineSummary` does not provide. Pure projection of the log:
 * every field is read straight off `HitEvent`s, no engine state. Totals/dps are
 * intentionally absent — the caller composes those from `getTimelineSummary`.
 */
export interface TeamStats {
  /** Summed `HitEvent.damage` keyed by `characterId` (team-contribution donut). */
  dmgByChar: Record<number, number>
  /** Hit count + damage grouped by `skillType` (type-distribution pie). */
  typeMix: Record<string, TypeEntry>
  /** Final `cumulativeConcerto`, read from the last hit. */
  concertoEnd: number
  /** Final `cumulativeEnergy`, read from the last hit. */
  resEnd: number
}

/**
 * Fold a Simulation Log into per-team aggregates. Only `HitEvent`s contribute —
 * sustains/actions/buff events carry no team-damage signal — so synthetic hits
 * (which deal real damage attributed to a character) are included. Keying axes
 * are load-bearing: `dmgByChar` by `characterId`, `typeMix` by `skillType` (the
 * damage classification, not `SkillCategory`).
 */
export function computeTeamStats(log: SimulationLogEntry[]): TeamStats {
  const dmgByChar: Record<number, number> = {}
  const typeMix: Record<string, TypeEntry> = {}
  let concertoEnd = 0
  let resEnd = 0

  for (const e of log) {
    if (e.kind !== "hit") continue
    dmgByChar[e.characterId] = (dmgByChar[e.characterId] ?? 0) + e.damage
    const entry = (typeMix[e.skillType] ??= { count: 0, dmg: 0 })
    entry.count += 1
    entry.dmg += e.damage
    concertoEnd = e.cumulativeConcerto
    resEnd = e.cumulativeEnergy
  }

  return { dmgByChar, typeMix, concertoEnd, resEnd }
}
