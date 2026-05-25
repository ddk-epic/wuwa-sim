import { useTeamContext } from "#/hooks/useTeamContext"
import { CharacterGrid } from "#/components/team/CharacterGrid"
import { TeamPanel } from "#/components/team/TeamPanel"
import { Modal } from "#/components/ui/Modal"

interface TeamModalProps {
  onClose: () => void
}

export function TeamModal({ onClose }: TeamModalProps) {
  const { selectedCount } = useTeamContext()
  return (
    <Modal
      onClose={onClose}
      variant="fullscreen"
      title="Team Builder"
      headerExtra={
        <span className="font-mono text-xs text-muted-foreground/70">
          {selectedCount}/3 selected
        </span>
      }
      panelClassName="w-full min-w-5xl max-w-350 flex flex-col"
    >
      <div className="flex gap-3 min-h-0">
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
