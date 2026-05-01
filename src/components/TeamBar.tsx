import { useState } from "react"
import { CalendarSearch } from "lucide-react"
import type { Slots } from "#/types/loadout"
import { getCharacterById } from "#/lib/catalog"
import { ConfirmModal } from "./ConfirmModal"

interface TeamBarProps {
  slots: Slots
  onEditTeam: () => void
  onResetTimeline: () => void
  onSimulate: () => void
  onOpenSimulationLog: () => void
  timelineEmpty: boolean
  totalDmg: number
  dps: number
  totalTimeSec: number
}

export function TeamBar({
  slots,
  onEditTeam,
  onResetTimeline,
  onSimulate,
  onOpenSimulationLog,
  timelineEmpty,
  totalDmg,
  dps,
  totalTimeSec,
}: TeamBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const label = slots
    .map((charId) => {
      if (charId === null) return "—"
      return getCharacterById(charId)?.name ?? "—"
    })
    .join(" / ")

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 shrink-0">
      <button
        className="px-3 py-1 rounded bg-gray-800 border border-gray-700 hover:border-gray-500 text-sm text-gray-300 transition-colors"
        onClick={onEditTeam}
      >
        {label}
      </button>
      <div className="ml-auto flex items-center gap-4">
        <div className="flex gap-7">
          <div className="flex flex-col items-center">
            <span className="text-[14px] text-gray-400 uppercase">
              Total DMG
            </span>
            <span className="text-base text-yellow-400">
              {totalDmg.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[14px] text-gray-400 uppercase">DPS</span>
            <span className="text-sm text-white">{dps.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[14px] text-gray-400 uppercase">Time</span>
            <span className="text-sm text-white">
              {totalTimeSec.toFixed(2)}s
            </span>
          </div>
        </div>
        <div className="w-px h-6 bg-gray-700 mx-1" />
        <div className="ml-auto flex items-center gap-2">
          <button
            className="px-3 py-1 rounded bg-gray-700 text-sm text-white transition-colors disabled:opacity-40 enabled:hover:bg-blue-600"
            disabled={timelineEmpty}
            onClick={onSimulate}
          >
            Simulate
          </button>
          <button
            className="p-1.5 rounded bg-gray-700 text-white transition-colors hover:bg-gray-600"
            onClick={onOpenSimulationLog}
            aria-label="Open simulation log"
          >
            <CalendarSearch size={20} />
          </button>
        </div>
        <div className="w-px h-6 bg-gray-700 mx-1" />
        <button
          className="px-3 py-1 rounded bg-gray-700 text-sm text-white transition-colors disabled:opacity-40 enabled:hover:bg-red-600"
          disabled={timelineEmpty}
          onClick={() => setConfirmOpen(true)}
        >
          Reset Timeline
        </button>
      </div>
      {confirmOpen && (
        <ConfirmModal
          message="Reset timeline? This cannot be undone."
          onConfirm={() => {
            onResetTimeline()
            setConfirmOpen(false)
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
