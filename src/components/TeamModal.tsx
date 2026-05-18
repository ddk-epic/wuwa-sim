import { useTeamContext } from "#/hooks/useTeamContext"
import { CharacterGrid } from "#/components/CharacterGrid"
import { TeamPanel } from "#/components/TeamPanel"
import { Modal } from "#/components/Modal"

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
      subtitle={`${selectedCount}/3 selected`}
    >
      <div className="flex-1 overflow-y-auto p-6">
        <CharacterGrid />
      </div>
      <div className="border-t border-gray-700 p-4 shrink-0">
        <TeamPanel />
      </div>
    </Modal>
  )
}
