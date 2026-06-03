import { LabelBtn } from "#/components/ui/LabelBtn"
import { TeamBuilderModal } from "./TeamBuilderModal"

/**
 * The simulator's "Edit Team" modal: the shared body under the live `useTeam`
 * provider. Edits auto-persist to `wuwa.team`, so the only footer action is
 * Close.
 */
export function EditTeamModal({ onClose }: { onClose: () => void }) {
  return (
    <TeamBuilderModal
      onClose={onClose}
      footer={<LabelBtn label="Close" onClick={onClose} />}
    />
  )
}
