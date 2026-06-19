import { TeamBuilderModal } from "./TeamBuilderModal"
import { AutosaveIndicator } from "./AutosaveIndicator"

/**
 * The simulator's "Edit Team" modal: the Team Builder under the live `useTeam`
 * provider. Edits auto-persist to `wuwa.team`, so there is no footer — closing
 * happens via the header X, Escape, or overlay-click — and the header carries
 * an autosave indicator reassuring the user the change stuck.
 */
export function EditTeamModal({ onClose }: { onClose: () => void }) {
  return (
    <TeamBuilderModal onClose={onClose} headerExtra={<AutosaveIndicator />} />
  )
}
