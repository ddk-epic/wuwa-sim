import { useState } from "react"
import { Modal } from "#/components/ui/Modal"
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
    <Modal
      onClose={onClose}
      variant="fullscreen"
      panelClassName="w-full h-full max-w-330 max-h-[95vh] flex flex-col"
      title="Simulation Log"
      titleAside={
        <span className="font-mono text-xs text-muted-foreground/70">
          {hitCount} hits
        </span>
      }
      headerExtra={
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={showBuffs}
            onChange={(e) => setShowBuffs(e.target.checked)}
          />
          Show buff events
        </label>
      }
    >
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-scroll">
        {log.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">
            No simulation data. Click Simulate to generate.
          </p>
        ) : (
          <LogTable log={filtered} />
        )}
      </div>
    </Modal>
  )
}
