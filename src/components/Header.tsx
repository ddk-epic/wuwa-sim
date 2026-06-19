import { useRef, useState } from "react"
import {
  CheckIcon,
  DownloadIcon,
  ListCheckIcon,
  PlayIcon,
  RotateCcw,
  SaveIcon,
  SettingsIcon,
} from "lucide-react"
import type { Slots } from "#/types/loadout"
import {
  elementHex,
  portraitSrc,
  nameInitial,
} from "#/components/ui/character-visual"
import { getCharacterById } from "#/lib/loadout/catalog"
import { useAtomValue } from "jotai"
import { teamAtom } from "#/state/team"
import { ConfirmModal } from "./ui/ConfirmModal"
import { ImportExportModal } from "./ImportExportModal"
import { CharacterPortrait } from "#/components/ui/CharacterPortrait"
import { IconBtn } from "#/components/ui/IconBtn"

interface HeaderProps {
  onEditTeam: () => void
  onResetTimeline: () => void
  onSimulate: () => void
  onSaveTeam: () => void
  onOpenSimulationLog: () => void
  onOpenSettings: () => void
  timelineEmpty: boolean
  logEmpty: boolean
  saveDisabled: boolean
  autoRun: boolean
  needsRun: boolean
  exportString: string
  onImport: (value: string) => void
  importError: string | null
}

export function Header({
  onEditTeam,
  onResetTimeline,
  onSimulate,
  onSaveTeam,
  onOpenSimulationLog,
  onOpenSettings,
  timelineEmpty,
  logEmpty,
  saveDisabled,
  autoRun,
  needsRun,
  exportString,
  onImport,
  importError,
}: HeaderProps) {
  const { slots } = useAtomValue(teamAtom)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importExportOpen, setImportExportOpen] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const simulateDisabled = autoRun ? !needsRun : timelineEmpty

  function handleSave(e: React.MouseEvent<HTMLButtonElement>) {
    onSaveTeam()
    const btn = e.currentTarget
    btn.dataset.saved = "true"
    btn.disabled = true
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      btn.removeAttribute("data-saved")
      btn.disabled = false
    }, 1500)
  }

  return (
    <div className="h-12 flex items-stretch shrink-0">
      {/* Left zone */}
      <div className="flex-1 flex items-center gap-4 px-4 bg-card border-b border-border">
        <div>
          <span className="tracking-[0.5px] font-semibold text-2xl text-foreground">
            WUWA
          </span>
          <span className="pr-2 tracking-[0.5px] font-semibold text-yellow-400">
            Sim
          </span>
        </div>
        <TeamButton slots={slots} onClick={onEditTeam} />
        <div className="ml-auto flex items-center gap-2">
          <button
            className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border text-muted-foreground disabled:text-muted-foreground/40 enabled:hover:text-foreground"
            disabled={simulateDisabled}
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
          className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground disabled:text-muted-foreground/40 enabled:hover:text-foreground"
          disabled={saveDisabled}
          onClick={handleSave}
          aria-label="Save team to library"
        >
          <SaveIcon className="w-4 h-4 in-data-saved:hidden" />
          <CheckIcon className="w-4 h-4 hidden in-data-saved:block text-green-400" />
          <span>Save</span>
        </button>
        <button
          className="flex items-center gap-1 px-2.5 py-1.25 font-mono text-sm rounded-sm border border-border text-muted-foreground hover:text-foreground"
          aria-label="Import/Export"
          onClick={() => setImportExportOpen(true)}
        >
          <DownloadIcon className="w-4 h-4" />
          <span>Import/Export</span>
        </button>
        <div className="ml-auto" />
        <IconBtn
          icon={SettingsIcon}
          label="Open settings"
          size={22}
          w={35}
          h={35}
          onClick={onOpenSettings}
        />
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
      {importExportOpen && (
        <ImportExportModal
          exportString={exportString}
          onImport={onImport}
          importError={importError}
          onClose={() => setImportExportOpen(false)}
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
      className="group flex items-center gap-3 h-10 pl-3.5 pr-3.5 rounded-md bg-transparent border border-gray-500/10 hover:border-gray-500/20 hover:bg-gray-500/6 transition-colors"
    >
      {filled.length > 0 && (
        <div className="flex items-center gap-1 -ml-1.5">
          {filled.map((char) => {
            return (
              <div
                key={char!.id}
                className="w-9 h-9 rounded-sm overflow-hidden"
              >
                <CharacterPortrait
                  src={portraitSrc(char!.name)}
                  alt={char!.name}
                  initial={nameInitial(char!.name)}
                  hex={elementHex(char!.element)}
                  className="w-full h-full object-cover"
                />
              </div>
            )
          })}
        </div>
      )}
      <div className="flex flex-col items-start leading-tight text-left">
        <span className="text-sm font-semibold text-gray-100 tracking-tight">
          {teamLabel}
        </span>
        {memberNames.length > 0 && (
          <span className="mt-0.5 text-micro text-gray-400 tracking-tight">
            {memberNames.join(" · ")}
          </span>
        )}
      </div>
    </button>
  )
}
