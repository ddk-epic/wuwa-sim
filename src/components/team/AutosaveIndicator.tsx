import { CheckIcon } from "lucide-react"
import { useTeamContext } from "#/hooks/useTeamContext"
import { useAutosaveIndicator } from "#/hooks/useAutosaveIndicator"

/**
 * Edit-flow autosave feedback for the Team Builder header. Watches the live
 * team value (name, slots, loadouts, settings) — uniform coverage with no
 * per-setter wrapping — and renders a muted, green-free "Saving…" / "✓ Saved".
 * Focus changes (`focusedId`) are intentionally excluded so navigating slots
 * doesn't flash the indicator.
 */
export function AutosaveIndicator() {
  const { name, slots, loadouts, settings } = useTeamContext()
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
