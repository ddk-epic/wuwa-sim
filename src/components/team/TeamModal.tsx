import { useTeamContext } from "#/hooks/useTeamContext"
import { CharacterGrid } from "#/components/team/CharacterGrid"
import { TeamPanel } from "#/components/team/TeamPanel"
import { Modal } from "#/components/ui/Modal"
import { XIcon } from "lucide-react"

interface TeamModalProps {
  onClose: () => void
}

export function TeamModal({ onClose }: TeamModalProps) {
  const { selectedCount } = useTeamContext()
  return (
    <Modal
      onClose={onClose}
      variant="fullscreen"
      panelClassName="w-full min-w-4xl max-w-7xl bg-card rounded-2xl flex flex-col"
    >
      <div className="flex items-center px-5 pt-4 pb-5">
        <div className="flex items-baseline gap-3 flex-1">
          <span className="text-xl font-semibold text-foreground">
            Team Builder
          </span>
          <span className="font-mono text-xs text-muted-foreground/70">
            {selectedCount}/3 selected
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="flex gap-3 px-5 pb-5 min-h-0">
        <div className="w-1/4 shrink-0 overflow-y-auto">
          <CharacterGrid />
        </div>
        <div className="flex-1 min-w-0">
          <TeamPanel />
        </div>
      </div>
    </Modal>
  )
}
