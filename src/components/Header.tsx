import { useState } from "react"
import {
  DownloadIcon,
  ListCheckIcon,
  PlayIcon,
  RotateCcw,
  SettingsIcon,
  UploadIcon,
} from "lucide-react"
import type { Slots } from "#/types/loadout"
import { ELEMENT_HEX } from "#/data/elements"
import { getCharacterById } from "#/lib/catalog"
import {
  useReactionDelay,
  useSettingsActions,
  useSwapFrames,
} from "#/hooks/useSettingsContext"
import { useTeamContext } from "#/hooks/useTeamContext"
import { ConfirmModal } from "./ConfirmModal"
import { SettingsModal } from "./SettingsModal"
import { avatarFallbackSrc } from "#/lib/avatar-fallback"

interface HeaderProps {
  onEditTeam: () => void
  onResetTimeline: () => void
  onSimulate: () => void
  onOpenSimulationLog: () => void
  timelineEmpty: boolean
  logEmpty: boolean
}

export function Header({
  onEditTeam,
  onResetTimeline,
  onSimulate,
  onOpenSimulationLog,
  timelineEmpty,
  logEmpty,
}: HeaderProps) {
  const { slots } = useTeamContext()
  const reactionDelay = useReactionDelay()
  const swapFrames = useSwapFrames()
  const { setSettings } = useSettingsActions()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="h-12 flex items-stretch shrink-0">
      {/* Left zone */}
      <div className="flex-1 flex items-center gap-4 px-4 bg-card border-b border-border">
        <div>
          <span className="tracking-[0.5px] font-semibold text-2xl text-foreground">
            WUWA
          </span>
          <span className="pr-2 tracking-[0.5px] font-semibold text-2xl text-[24px] text-yellow-400">
            Sim
          </span>
        </div>
        <TeamButton slots={slots} onClick={onEditTeam} />
        <div className="ml-auto flex items-center gap-2">
          <button
            className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border text-muted-foreground disabled:text-muted-foreground/40 enabled:hover:text-foreground"
            disabled={timelineEmpty}
            onClick={onSimulate}
            aria-label="Run simulate"
          >
            <PlayIcon className="w-4 h-4 mb-px" />
            <span>Simulate</span>
          </button>
          <button
            className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground disabled:text-muted-foreground/40 enabled:hover:text-foreground"
            disabled={logEmpty}
            onClick={onOpenSimulationLog}
            aria-label="Open simulation log"
          >
            <ListCheckIcon className="w-4 h-4" />
            <span>Log</span>
          </button>
          <button
            className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground disabled:text-muted-foreground/40 enabled:hover:text-foreground"
            disabled={timelineEmpty}
            onClick={() => setConfirmOpen(true)}
            aria-label="Reset Timeline"
          >
            <RotateCcw className="w-4 h-4 mb-px" />
            <span>Reset</span>
          </button>
        </div>
      </div>
      {/* Right zone */}
      <div className="w-100 flex items-center gap-2 px-4 bg-darkest border-b border-border border-l">
        <button
          className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground hover:text-foreground"
          aria-label="Import"
        >
          <UploadIcon className="w-4 h-4" />
          <span>Import</span>
        </button>
        <button
          className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground hover:text-foreground"
          aria-label="Export"
        >
          <DownloadIcon className="w-4 h-4" />
          <span>Export</span>
        </button>
        <div className="ml-auto" />
        <button
          className="flex items-center gap-1 p-1.25 font-mono text-sm rounded-sm text-muted-foreground disabled:opacity-40 enabled:hover:text-foreground"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
        >
          <SettingsIcon className="w-5 h-5" />
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
          swapFrames={swapFrames}
          onReactionDelayChange={(value) =>
            setSettings({ reactionDelay: value })
          }
          onSwapFramesChange={(value) => setSettings({ swapFrames: value })}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

interface TeamButtonProps {
  slots: Slots
  onClick: () => void
}

function TeamButton({ slots, onClick }: TeamButtonProps) {
  const filled = slots
    .map((id) => (id !== null ? getCharacterById(id) : null))
    .filter(Boolean)

  const leadChar =
    (slots[0] !== null ? getCharacterById(slots[0]) : null) ?? filled[0] ?? null
  const teamLabel = leadChar ? `${leadChar.name}'s Team` : "No Team"
  const memberNames = filled.map((c) => c!.name)

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 h-10 pl-2 pr-3.5 rounded-md bg-transparent border border-gray-500/10 hover:border-gray-500/20 hover:bg-gray-500/6 transition-colors"
    >
      <div className="flex items-center gap-1">
        {filled.length === 0 ? (
          <div className="w-9 h-9 rounded-sm bg-white/4" />
        ) : (
          filled.map((char) => {
            const hex = ELEMENT_HEX[char!.element] ?? "#888"
            const name = char!.name.toLowerCase()
            return (
              <div
                key={char!.id}
                className="w-9 h-9 rounded-sm overflow-hidden"
              >
                <img
                  src={`/${name}.png`}
                  alt={char!.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = avatarFallbackSrc(
                      char!.name[0].toUpperCase(),
                      hex,
                    )
                  }}
                />
              </div>
            )
          })
        )}
      </div>
      <div className="flex flex-col items-start leading-tight text-left">
        <span className="text-sm font-semibold text-gray-100 tracking-tight">
          {teamLabel}
        </span>
        {memberNames.length > 0 && (
          <span className="mt-0.5 text-[13px] text-gray-400 tracking-tight">
            {memberNames.join(" · ")}
          </span>
        )}
      </div>
    </button>
  )
}
