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
}

export function Header({
  onEditTeam,
  onResetTimeline,
  onSimulate,
  onOpenSimulationLog,
  timelineEmpty,
}: HeaderProps) {
  const { slots } = useTeamContext()
  const reactionDelay = useReactionDelay()
  const { setReactionDelay } = useSettingsActions()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const filledChars = slots
    .map((id) => (id !== null ? getCharacterById(id) : null))
    .filter(Boolean)

  const teamNameChar =
    (slots[0] !== null ? getCharacterById(slots[0]) : null) ??
    filledChars[0] ??
    null
  const teamLabel = teamNameChar ? `${teamNameChar.name}'s Team` : "No Team"
  const memberNames = filledChars.map((c) => c!.name).join(" · ")

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
        <button
          className="flex items-center gap-2 px-3 py-1 rounded bg-gray-800 border border-gray-700 hover:border-gray-500 text-sm text-gray-300 transition-colors"
          onClick={onEditTeam}
        >
          <AvatarStack slots={slots} />
          <div className="flex flex-col items-start leading-tight">
            <span className="text-xs font-semibold text-gray-200">
              {teamLabel}
            </span>
            {memberNames && (
              <span className="text-[10px] text-gray-400">{memberNames}</span>
            )}
          </div>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border text-muted-foreground disabled:opacity-40 enabled:hover:text-foreground"
            disabled={timelineEmpty}
            onClick={onSimulate}
            aria-label="Run simulate"
          >
            <PlayIcon className="w-4 h-4 mb-px" />
            <span>Simulate</span>
          </button>
          <button
            className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground disabled:opacity-40 enabled:hover:text-foreground"
            onClick={onOpenSimulationLog}
            aria-label="Open simulation log"
          >
            <ListCheckIcon className="w-4 h-4" />
            <span>Log</span>
          </button>
          <button
            className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground disabled:opacity-40 enabled:hover:text-foreground"
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
          onReactionDelayChange={setReactionDelay}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

interface AvatarStackProps {
  slots: Slots
}

function AvatarStack({ slots }: AvatarStackProps) {
  const chars = slots
    .map((id) => (id !== null ? getCharacterById(id) : null))
    .filter(Boolean)

  if (chars.length === 0) return null

  return (
    <div className="flex items-center">
      {chars.map((char, i) => {
        const hex = ELEMENT_HEX[char!.element] ?? "#888"
        const name = char!.name.toLowerCase()
        return (
          <img
            key={char!.id}
            src={`/${name}.png`}
            alt={char!.name}
            className="w-6.5 h-6.5 rounded-full object-cover"
            style={{
              marginLeft: i > 0 ? "-6px" : undefined,
              outline: `2px solid ${hex}`,
              outlineOffset: "0px",
            }}
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = avatarFallbackSrc(
                char!.name[0].toUpperCase(),
                hex,
              )
            }}
          />
        )
      })}
    </div>
  )
}
