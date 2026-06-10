import type { DelayBreakdown } from "#/types/simulation-log"
import { formatFrames } from "#/lib/format"

/**
 * Sums a Padding Delay breakdown and renders its tooltip. Returns `null` when
 * there is no delay. `floor`/`react` are mutually exclusive (floor wins);
 * `pad`/`fall`/`swapBack`/`priorGate` are appended in order. `priorGate` already
 * holds the gate's pad beyond `swapBack` (see DelayBreakdown), so summing stays
 * correct despite the two being a `max`-combine at source.
 */
export function formatPaddingDelay(
  d: DelayBreakdown,
): { total: number; tooltip: string } | null {
  const total = d.react + d.floor + d.pad + d.fall + d.swapBack + d.priorGate
  if (total === 0) return null
  const tooltip = [
    d.floor > 0
      ? `floor: ${formatFrames(d.floor)}`
      : d.react > 0
        ? `react: ${formatFrames(d.react)}`
        : "",
    d.pad > 0 ? `pad: ${formatFrames(d.pad)}` : "",
    d.fall > 0 ? `fall: ${formatFrames(d.fall)}` : "",
    d.swapBack > 0 ? `swap-back: ${formatFrames(d.swapBack)}` : "",
    d.priorGate > 0 ? `prior-gate: ${formatFrames(d.priorGate)}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  return { total, tooltip }
}

/** The `+N` Padding Delay badge with its breakdown tooltip. */
export function DelayBadge({
  delay,
  className,
}: {
  delay?: DelayBreakdown
  className?: string
}) {
  if (!delay) return null
  const f = formatPaddingDelay(delay)
  if (!f) return null
  return (
    <span
      className={`text-xs text-muted-foreground ${className ?? ""}`}
      title={f.tooltip}
    >
      +{formatFrames(f.total)}
    </span>
  )
}
