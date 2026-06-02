import type { ReactNode } from "react"
import { useTeamContext } from "#/hooks/useTeamContext"
import { Modal } from "#/components/ui/Modal"
import { TeamBuilderBody } from "./TeamBuilderBody"

/**
 * The Team Builder modal chrome shared by the sim (edit) and Library (create)
 * wrappers: fullscreen Modal, "n/3 selected" header, the shared body, and a
 * caller-supplied `footer` (Close vs. Move to sim). Reads `useTeamContext`, so
 * it must render inside a Team provider.
 */
export function TeamBuilderModal({
  onClose,
  footer,
}: {
  onClose: () => void
  footer: ReactNode
}) {
  const { selectedCount } = useTeamContext()
  return (
    <Modal
      onClose={onClose}
      variant="fullscreen"
      title="Team Builder"
      titleAside={
        <span className="font-mono text-xs text-muted-foreground/70">
          {selectedCount}/3 selected
        </span>
      }
      panelClassName="w-full min-w-5xl max-w-350 flex flex-col"
    >
      <TeamBuilderBody />
      <div className="flex justify-end gap-2 pt-4 shrink-0">{footer}</div>
    </Modal>
  )
}
