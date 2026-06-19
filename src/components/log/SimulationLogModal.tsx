import { useState } from "react"
import { Modal } from "#/components/ui/Modal"
import { EmptyStatement } from "#/components/ui/EmptyStatement"
import type { LogVariant, SimulationLogEntry } from "#/types/simulation-log"
import { useAtomValue } from "jotai"
import { defaultLogVariantAtom } from "#/state/preferences"
import { LogTable } from "./LogTable"
import { isBuff } from "./BuffEventRow"
import { BuffTimelineLog, BuffTimelineKpis } from "./BuffTimelineLog"

interface SimulationLogModalProps {
  log: SimulationLogEntry[]
  rosterIds: number[]
  totalDamage: number
  dps: number
  totalTimeFrames: number
  onClose: () => void
}

export function SimulationLogModal({
  log,
  rosterIds,
  totalDamage,
  dps,
  totalTimeFrames,
  onClose,
}: SimulationLogModalProps) {
  const hitCount = log.filter((e) => e.kind === "hit").length
  const [showBuffs, setShowBuffs] = useState(true)
  const [variant, setVariant] = useState<LogVariant>(
    useAtomValue(defaultLogVariantAtom),
  )
  const filtered = showBuffs ? log : log.filter((e) => !isBuff(e))

  return (
    <Modal
      onClose={onClose}
      variant="fullscreen"
      panelClassName="w-full h-full max-w-380 max-h-[95vh] flex flex-col"
      title="Simulation Log"
      titleAside={
        <span className="font-mono text-xs text-muted-foreground/70">
          {hitCount} hits
        </span>
      }
      headerExtra={
        <div className="flex items-center gap-4">
          {variant === "timeline" && (
            <BuffTimelineKpis
              totalDamage={totalDamage}
              dps={dps}
              totalTimeFrames={totalTimeFrames}
            />
          )}
          {variant === "table" && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={showBuffs}
                onChange={(e) => setShowBuffs(e.target.checked)}
              />
              Show buff events
            </label>
          )}
          <div className="flex items-center rounded-md border border-border overflow-hidden text-xs font-medium">
            {(["table", "timeline"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                className={
                  "px-2.5 py-1 capitalize transition-colors " +
                  (variant === v
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {log.length === 0 ? (
        <div className="flex-1 min-h-0">
          <EmptyStatement
            className="h-full"
            statement="No simulation data"
            description="Run a simulation to generate a detailed combat log."
          />
        </div>
      ) : variant === "timeline" ? (
        <BuffTimelineLog log={log} rosterIds={rosterIds} />
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-scroll">
          <LogTable log={filtered} />
        </div>
      )}
    </Modal>
  )
}
