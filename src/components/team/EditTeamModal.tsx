import { TeamBuilderModal } from "./TeamBuilderModal"

/**
 * The simulator's "Edit Team" modal: the Team Builder under the live `useTeam`
 * provider. Edits auto-persist to `wuwa.team`, so there is no footer — closing
 * happens via the header X, Escape, or overlay-click.
 */
export function EditTeamModal({ onClose }: { onClose: () => void }) {
  return <TeamBuilderModal onClose={onClose} />
}
