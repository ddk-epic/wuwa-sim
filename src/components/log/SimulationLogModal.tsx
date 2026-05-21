import { useState } from "react"
import { XIcon } from "lucide-react"
import type { SimulationLogEntry } from "#/types/simulation-log"
import { LogTable } from "./LogTable"
import { isBuff } from "./BuffEventRow"

interface SimulationLogModalProps {
  log: SimulationLogEntry[]
  onClose: () => void
}

export function SimulationLogModal({ log, onClose }: SimulationLogModalProps) {
  const hitCount = log.filter((e) => e.kind === "hit").length
  const [showBuffs, setShowBuffs] = useState(true)
  const filtered = showBuffs ? log : log.filter((e) => !isBuff(e))

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-330 max-h-[95vh] bg-card rounded-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-5 pt-4 pb-5">
          <div className="flex items-baseline gap-3 flex-1">
            <span className="text-xl font-semibold text-foreground">
              Simulation Log
            </span>
            <span className="font-mono text-xs text-muted-foreground/70">
              {hitCount} hits
            </span>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none mr-4">
            <input
              type="checkbox"
              checked={showBuffs}
              onChange={(e) => setShowBuffs(e.target.checked)}
            />
            Show buff events
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto px-5 pb-5">
          {log.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              No simulation data. Click Simulate to generate.
            </p>
          ) : (
            <LogTable log={filtered} />
          )}
        </div>
      </div>
    </div>
  )
}
