import { useNavigate } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { DraftTeamProvider } from "#/hooks/useDraftTeam"
import { useTeamContext } from "#/hooks/useTeamContext"
import { moveDraftToLive } from "#/hooks/useLibrary"
import { suggestedTeamName } from "#/lib/loadout/team-ops"
import { HBtn } from "#/components/ui/HBtn"
import { TeamBuilderModal } from "./TeamBuilderModal"

/** The create modal's only commit: write the draft into the live Session, then jump to /sim. */
function MoveToSimButton() {
  const { name, slots, loadouts, focusedId } = useTeamContext()
  const navigate = useNavigate()
  return (
    <HBtn
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
 * in-memory draft (never touching live state). No save-to-library and no
 * gating — the only commit is "Move to sim".
 */
export function CreateTeamModal({ onClose }: { onClose: () => void }) {
  return (
    <DraftTeamProvider>
      <TeamBuilderModal onClose={onClose} footer={<MoveToSimButton />} />
    </DraftTeamProvider>
  )
}
