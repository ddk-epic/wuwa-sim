import { useMemo } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { Provider, createStore, useAtomValue } from "jotai"
import { teamAtom, draftActiveTeam } from "#/state/team"
import { moveDraftToLive } from "#/hooks/useLibrary"
import { suggestedTeamName } from "#/lib/loadout/team-ops"
import { LabelBtn } from "#/components/ui/LabelBtn"
import { TeamBuilderModal } from "./TeamBuilderModal"

/** The create modal's only commit: write the draft into the live Session, then jump to /sim. */
function MoveToSimButton() {
  const { name, slots, loadouts, focusedId } = useAtomValue(teamAtom)
  const navigate = useNavigate()
  return (
    <LabelBtn
      icon={ArrowRight}
      label="Move to sim"
      primary
      onClick={() => {
        const finalName = name.trim() || suggestedTeamName(slots)
        moveDraftToLive({ name: finalName, slots, loadouts, focusedId })
        navigate({ to: "/sim" })
      }}
    />
  )
}

/**
 * The Library's "New team" modal: the shared Team Builder body over a fresh
 * in-memory draft. The bare `<Provider>` gives this subtree its own Jotai store,
 * so the builder edits a throwaway team that never touches `wuwa.team` (no
 * persistence bridge is mounted inside it). The only commit is "Move to sim".
 */
export function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const store = useMemo(() => {
    const s = createStore()
    s.set(teamAtom, draftActiveTeam())
    return s
  }, [])
  return (
    <Provider store={store}>
      <TeamBuilderModal
        onClose={onClose}
        autoEdit
        footer={<MoveToSimButton />}
      />
    </Provider>
  )
}
