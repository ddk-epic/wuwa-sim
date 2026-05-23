import type { BuffEvent, SimulationLogEntry } from "#/types/simulation-log"
import { isBuff } from "./BuffEventRow"

export interface GroupedBuffEntry {
  buffId: string
  buffName: string
  stacks: number
  targetCharacterIds: number[]
}

export interface BuffGroupRow {
  kind: "buffGroup"
  frame: number
  buffKind: BuffEvent["kind"]
  entries: GroupedBuffEntry[]
}

export interface SingleRow {
  kind: "single"
  entry: SimulationLogEntry
}

export type RenderRow = SingleRow | BuffGroupRow

export function groupBuffEvents(log: SimulationLogEntry[]): RenderRow[] {
  const rows: RenderRow[] = []
  let i = 0

  while (i < log.length) {
    const entry = log[i]

    if (!isBuff(entry)) {
      rows.push({ kind: "single", entry })
      i++
      continue
    }

    const groupFrame = entry.frame
    const groupKind = entry.kind
    const groupedEntries: GroupedBuffEntry[] = []

    while (i < log.length) {
      const e = log[i]
      if (!isBuff(e) || e.frame !== groupFrame || e.kind !== groupKind) break

      const existing = groupedEntries.find(
        (ge) => ge.buffId === e.buffId && ge.stacks === e.stacks,
      )
      if (existing) {
        existing.targetCharacterIds.push(e.targetCharacterId)
      } else {
        groupedEntries.push({
          buffId: e.buffId,
          buffName: e.buffName,
          stacks: e.stacks,
          targetCharacterIds: [e.targetCharacterId],
        })
      }

      i++
    }

    rows.push({
      kind: "buffGroup",
      frame: groupFrame,
      buffKind: groupKind,
      entries: groupedEntries,
    })
  }

  return rows
}
