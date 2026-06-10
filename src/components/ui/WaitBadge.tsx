import { formatFrames } from "#/lib/format"

/** Inline `+0.Xs` wait before an action starts (prior-stage gate). `null` at 0. */
export function WaitBadge({
  priorGate,
  className,
}: {
  priorGate: number
  className?: string
}) {
  if (priorGate === 0) return null
  return (
    <span
      className={`text-xs text-muted-foreground ${className ?? ""}`}
      title={`wait ${formatFrames(priorGate)}`}
    >
      +{formatFrames(priorGate)}
    </span>
  )
}
