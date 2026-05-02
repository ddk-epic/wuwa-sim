import { Fragment, useState } from "react"
import type { SimulationLogEntry } from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import { getCharacterById } from "#/lib/catalog"

interface SimulationLogModalProps {
  log: SimulationLogEntry[]
  onClose: () => void
}

export function SimulationLogModal({ log, onClose }: SimulationLogModalProps) {
  const hitCount = log.filter((e) => e.kind === "hit").length
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggleRow = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-gray-900 rounded-lg border border-gray-700 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-xl font-bold">Simulation Log</h2>
            <p className="text-gray-400 text-sm mt-0.5">{hitCount} hits</p>
          </div>
          <button
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {log.length === 0 ? (
            <p className="py-8 text-center text-gray-500 text-sm">
              No simulation data. Click Simulate to generate.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-gray-400">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Character</th>
                  <th className="py-2 pr-3">Skill Type</th>
                  <th className="py-2 pr-3">Skill</th>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3 text-right">Concerto</th>
                  <th className="py-2 pr-3 text-right">Energy</th>
                  <th className="py-2 text-right">Damage</th>
                </tr>
              </thead>
              <tbody>
                {log.map((entry, i) => {
                  const character = getCharacterById(entry.characterId)
                  const isAction = entry.kind === "action"
                  const isExpanded = expanded.has(i)
                  return (
                    <Fragment key={i}>
                      <tr
                        className={`border-b border-gray-800 ${isAction ? "" : "text-gray-500"} ${entry.kind === "hit" ? "cursor-pointer hover:bg-gray-800/40" : ""}`}
                        onClick={
                          entry.kind === "hit" ? () => toggleRow(i) : undefined
                        }
                      >
                        <td className="py-1 pr-3 text-gray-500">
                          {entry.kind === "hit"
                            ? `${isExpanded ? "▾" : "▸"} ${i + 1}`
                            : i + 1}
                        </td>
                        <td className="py-1 pr-3">{character?.name ?? "?"}</td>
                        <td className="py-1 pr-3 text-gray-400">
                          {isAction ? entry.skillType : ""}
                        </td>
                        <td className="py-1 pr-3">{entry.skillName}</td>
                        <td className="py-1 pr-3">
                          {(entry.frame / 60).toFixed(2)}s
                        </td>
                        <td className="py-1 pr-3 text-right">
                          {entry.cumulativeConcerto.toFixed(1)}
                        </td>
                        <td className="py-1 pr-3 text-right">
                          {entry.cumulativeEnergy.toFixed(1)}
                        </td>
                        <td className="py-1 text-right text-yellow-400">
                          {entry.kind === "hit"
                            ? entry.damage.toLocaleString()
                            : ""}
                        </td>
                      </tr>
                      {entry.kind === "hit" && isExpanded && (
                        <tr className="border-b border-gray-800 bg-gray-950/60">
                          <td colSpan={8} className="py-2 px-3">
                            <StatsSnapshotTable
                              snapshot={entry.statsSnapshot}
                              activeBuffIds={entry.activeBuffIds}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function StatsSnapshotTable({
  snapshot,
  activeBuffIds,
}: {
  snapshot: StatTable
  activeBuffIds: string[]
}) {
  const scalarRows: [string, number][] = [
    ["ATK Base", snapshot.atkBase],
    ["ATK %", snapshot.atkPct],
    ["ATK Flat", snapshot.atkFlat],
    ["Crit Rate", snapshot.critRate],
    ["Crit DMG", snapshot.critDmg],
    ["Def Shred", snapshot.defShred],
  ]
  const recordRows: [string, Record<string, number>][] = [
    ["Element Bonus", snapshot.elementBonus],
    ["Skill Type Bonus", snapshot.skillTypeBonus],
    ["Deepen", snapshot.deepen],
    ["Res Shred", snapshot.resShred],
  ]

  return (
    <div className="text-xs text-gray-300">
      <div className="font-semibold text-gray-400 mb-1">Stats snapshot</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5">
        {scalarRows.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-gray-500">{label}</span>
            <span>{value}</span>
          </div>
        ))}
        {recordRows.map(([label, rec]) => {
          const entries = Object.entries(rec)
          return (
            <div key={label} className="flex justify-between">
              <span className="text-gray-500">{label}</span>
              <span>
                {entries.length === 0
                  ? "—"
                  : entries.map(([k, v]) => `${k}: ${v}`).join(", ")}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-1 text-gray-500">
        Active buffs:{" "}
        {activeBuffIds.length === 0 ? "—" : activeBuffIds.join(", ")}
      </div>
    </div>
  )
}
