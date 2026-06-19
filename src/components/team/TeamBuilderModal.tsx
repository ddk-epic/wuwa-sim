import type { ReactNode } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { teamAtom, nameAtom } from "#/state/team"
import { suggestedTeamName } from "#/lib/loadout/team-ops"
import { Modal } from "#/components/ui/Modal"
import { InlineRename } from "#/components/ui/InlineRename"
import { CharacterGrid } from "#/components/team/CharacterGrid"
import { TeamPanel } from "#/components/team/TeamPanel"

/**
 * The Team Builder modal shared by the sim (edit) and Library (create) wrappers:
 * a fullscreen Modal with an inline-renamed name field stacked over the
 * character grid on the left and the per-slot panel on the right. Reads the
 * team atoms; the create flow scopes them to a throwaway draft `<Provider>`.
 * `autoEdit` opens the name field ready to type (create flow); `footer` and
 * `headerExtra` are optional caller-supplied chrome.
 */
export function TeamBuilderModal({
  onClose,
  footer,
  headerExtra,
  autoEdit = false,
}: {
  onClose: () => void
  footer?: ReactNode
  headerExtra?: ReactNode
  autoEdit?: boolean
}) {
  const { name, slots } = useAtomValue(teamAtom)
  const setName = useSetAtom(nameAtom)
  const selectedCount = slots.filter((s) => s !== null).length
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
      headerExtra={headerExtra}
      panelClassName="w-full min-w-5xl max-w-350 flex flex-col"
    >
      <div className="flex gap-3 min-h-0">
        <div className="w-1/4 shrink-0 flex flex-col min-h-0">
          <span className="-my-0.5 text-micro uppercase tracking-[1px] text-muted-foreground/70">
            Team name
          </span>
          <InlineRename
            value={name}
            onCommit={setName}
            placeholder={suggestedTeamName(slots)}
            ariaLabel="Team name"
            autoEdit={autoEdit}
            className="text-foreground w-full"
            wrapperClassName="rounded-sm px-1.5 pb-3 -mx-1.5 w-full"
          />
          <div className="overflow-y-auto min-h-0">
            <CharacterGrid />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <TeamPanel />
        </div>
      </div>
      {footer && (
        <div className="flex justify-end gap-2 pt-4 shrink-0">{footer}</div>
      )}
    </Modal>
  )
}
