import type { DelayBreakdown } from "#/types/simulation-log"
import { formatFrames } from "#/lib/format"

/**
 * Sums a Padding Delay breakdown's action-cost `pad` components and renders its
 * tooltip. Returns `null` when there is no delay. `floor`/`reaction` are mutually
 * exclusive (floor wins); `trailing`/`fall` are appended in order. The `wait`
 * floor is excluded — it's surfaced separately by `WaitBadge`.
 */
export function formatPaddingDelay(
  d: DelayBreakdown,
): { total: number; tooltip: string } | null {
  const { reaction, floor, trailing, fall } = d.pad
  const total = reaction + floor + trailing + fall
  if (total === 0) return null
  const tooltip = [
    floor > 0
      ? `floor: ${formatFrames(floor)}`
      : reaction > 0
        ? `react: ${formatFrames(reaction)}`
        : "",
    trailing > 0 ? `pad: ${formatFrames(trailing)}` : "",
    fall > 0 ? `fall: ${formatFrames(fall)}` : "",
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
