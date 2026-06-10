import { formatFrames } from "#/lib/format"

/** Inline `+0.Xs` wait before an action starts — the start floors (swap-back + prior-gate). `null` at 0. */
export function WaitBadge({
  swapBack = 0,
  priorGate = 0,
  className,
}: {
  swapBack?: number
  priorGate?: number
  className?: string
}) {
  const wait = swapBack + priorGate
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
