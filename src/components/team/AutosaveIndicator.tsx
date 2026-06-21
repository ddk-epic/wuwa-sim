import { CheckIcon } from "lucide-react"
import { useAtomValue } from "jotai"
import { nameAtom, slotsAtom, loadoutsAtom, settingsAtom } from "#/state/team"
import { useAutosaveIndicator } from "#/hooks/useAutosaveIndicator"

/**
 * Edit-flow autosave feedback for the Team Builder header. Subscribes to the
 * exact slices it feeds the hook (name, slots, loadouts, settings) and renders
 * a muted, green-free "Saving…" / "✓ Saved". Focus (`focusedId`) is deliberately
 * not subscribed, so navigating slots doesn't flash the indicator.
 */
export function AutosaveIndicator() {
  const name = useAtomValue(nameAtom)
  const slots = useAtomValue(slotsAtom)
  const loadouts = useAtomValue(loadoutsAtom)
  const settings = useAtomValue(settingsAtom)
  const status = useAutosaveIndicator({ name, slots, loadouts, settings })
  if (status === "idle") return null
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
      {status === "saving" ? (
        "Saving…"
      ) : (
        <>
          <CheckIcon className="w-3.5 h-3.5" />
          Saved
        </>
      )}
    </span>
  )
}
