import { useState } from "react"
import type { SimulationLogEntry } from "#/types/simulation-log"
import { Modal } from "#/components/Modal"
import { BuffEventRow } from "#/components/BuffEventRow"
import { HitEventRow } from "#/components/HitEventRow"

interface SimulationLogModalProps {
  log: SimulationLogEntry[]
  onClose: () => void
}

const BUFF_KINDS = new Set([
  "buffApplied",
  "buffRefreshed",
  "buffExpired",
  "buffConsumed",
])

export function SimulationLogModal({ log, onClose }: SimulationLogModalProps) {
  const hitCount = log.filter((e) => e.kind === "hit").length
  const [showBuffs, setShowBuffs] = useState(true)
  const filteredLog = showBuffs
    ? log
    : log.filter((e) => !BUFF_KINDS.has(e.kind))

  return (
    <Modal
      onClose={onClose}
      variant="fullscreen"
      panelClassName="w-full max-w-7xl max-h-[95vh] bg-card rounded-lg border border-gray-700 flex flex-col"
      title="Simulation Log"
      subtitle={`${hitCount} hits`}
      headerExtra={
        <label className="flex items-center gap-1.5 text-xs text-gray-400 select-none">
          <input
            type="checkbox"
            checked={showBuffs}
            onChange={(e) => setShowBuffs(e.target.checked)}
          />
          Show buff events
        </label>
      }
    >
      <div className="flex-1 min-h-0 overflow-auto p-4">
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
                <th className="py-2 pr-3 text-right">Damage</th>
                <th className="py-2 pr-3 text-right text-xs">Scaling</th>
                <th className="py-2 pr-3 text-right text-xs">ER</th>
                <th className="py-2 pr-3 text-right text-xs">CR</th>
                <th className="py-2 pr-3 text-right text-xs">CD</th>
                <th className="py-2 pr-3 text-right text-xs">DMG%</th>
                <th className="py-2 text-right text-xs">Deepen</th>
              </tr>
            </thead>
            <tbody>
              {filteredLog.map((entry, i) => {
                if (BUFF_KINDS.has(entry.kind)) {
                  const buff = entry as Extract<
                    SimulationLogEntry,
                    {
                      kind:
                        | "buffApplied"
                        | "buffRefreshed"
                        | "buffExpired"
                        | "buffConsumed"
                    }
                  >
                  return <BuffEventRow key={i} index={i} buff={buff} />
                }
                const ev = entry as Extract<
                  SimulationLogEntry,
                  { kind: "action" | "hit" }
                >
                return <HitEventRow key={i} index={i} ev={ev} />
              })}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}
