import { useTeamContext } from "#/hooks/useTeamContext"
import { CharacterGrid } from "#/components/team/CharacterGrid"
import { TeamPanel } from "#/components/team/TeamPanel"
import { Modal } from "#/components/ui/Modal"

interface TeamModalProps {
  onClose: () => void
}

export function TeamModal({ onClose }: TeamModalProps) {
  const { selectedCount, name, setName } = useTeamContext()
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
      <div className="flex flex-col gap-3 min-h-0">
        <label className="flex items-center gap-2 text-label text-muted-foreground/70">
          <span className="shrink-0">Team name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New team"
            aria-label="Team name"
            className="flex-1 min-w-0 bg-transparent border-b border-border outline-none text-foreground font-[inherit] py-1 focus:border-foreground/40"
          />
        </label>
        <div className="flex gap-3 min-h-0">
          <div className="w-1/4 shrink-0 overflow-y-auto">
            <CharacterGrid />
          </div>
          <div className="flex-1 min-w-0">
            <TeamPanel />
          </div>
        </div>
      </div>
    </Modal>
  )
}
