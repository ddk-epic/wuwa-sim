import { useState } from "react"
import { CalendarSearch, Settings } from "lucide-react"
import type { Slots } from "#/types/loadout"
import { getCharacterById } from "#/lib/catalog"
import { ConfirmModal } from "./ConfirmModal"
import { SettingsModal } from "./SettingsModal"

interface HeaderProps {
  slots: Slots
  onEditTeam: () => void
  onResetTimeline: () => void
  onSimulate: () => void
  onOpenSimulationLog: () => void
  timelineEmpty: boolean
  reactionDelay: number
  onReactionDelayChange: (value: number) => void
}

export function Header({
  slots,
  onEditTeam,
  onResetTimeline,
  onSimulate,
  onOpenSimulationLog,
  timelineEmpty,
  reactionDelay,
  onReactionDelayChange,
}: HeaderProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const label = slots
    .map((charId) => {
      if (charId === null) return "—"
      return getCharacterById(charId)?.name ?? "—"
    })
    .join(" / ")

  return (
    <div className="h-12 flex items-center shrink-0 gap-4 px-4 py-2 border-b border-border bg-card">
      <div>
        <span className="tracking-[0.5px] font-semibold text-2xl text-foreground">
          WUWA
        </span>
        <span className="pr-2 tracking-[0.5px] font-semibold text-2xl text-[24px] text-yellow-400">
          Sim
        </span>
      </div>
      <button
        className="px-3 py-1 rounded bg-gray-800 border border-gray-700 hover:border-gray-500 text-sm text-gray-300 transition-colors"
        onClick={onEditTeam}
      >
        {label}
      </button>
      <div className="ml-auto flex items-center gap-4">
        {/** Buttons */}
        <button
          className="items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-tag bg-tag-bg text-muted-foreground disabled:opacity-40 enabled:hover:text-foreground"
          disabled={timelineEmpty}
          onClick={onSimulate}
        >
          Simulate
        </button>
        <button
          className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground disabled:opacity-40 enabled:hover:text-foreground"
          onClick={onOpenSimulationLog}
          aria-label="Open simulation log"
        >
          <CalendarSearch size={20} />
          <span>Log</span>
        </button>
        <button
          className="items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground disabled:opacity-40 enabled:hover:text-foreground"
          disabled={timelineEmpty}
          onClick={() => setConfirmOpen(true)}
        >
          Reset
        </button>
        <div className="w-px h-6 bg-gray-700 mx-1" />
        <button
          className="items-center gap-1 p-1.75 font-mono text-sm rounded-sm border border-border text-muted-foreground disabled:opacity-40 enabled:hover:text-foreground"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
        >
          <Settings size={20} />
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
      {settingsOpen && (
        <SettingsModal
          reactionDelay={reactionDelay}
          onReactionDelayChange={onReactionDelayChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
