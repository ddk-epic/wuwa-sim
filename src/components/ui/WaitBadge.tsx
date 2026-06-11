import { formatFrames } from "#/lib/format"

/** Inline `+0.Xs` wait before an action starts — the start floor (swap-back / prior-gate, max-combined). `null` at 0. */
export function WaitBadge({
  wait = 0,
  className,
}: {
  wait?: number
  className?: string
}) {
  if (wait === 0) return null
  return (
    <span
      className={`text-xs text-muted-foreground ${className ?? ""}`}
      title={`wait ${formatFrames(wait)}`}
    >
      +{formatFrames(wait)}
    </span>
  )
}
