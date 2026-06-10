import { formatFrames } from "#/lib/format"
import { PoolValue } from "../ui/PoolValue"
import { WaitBadge } from "../ui/WaitBadge"

/** Leading time cell, accented in the damage color. */
export function TimeCell({ frames }: { frames: number }) {
  return (
    <td className="px-2 py-2 text-right font-mono text-label text-ui-damage">
      {formatFrames(frames)}
    </td>
  )
}

/**
 * Prior-gate wait cell, holding the `WaitBadge` (or empty). Rendered right of
 * the time only when the table has any wait, so the time column is undisturbed.
 */
export function WaitCell({
  swapBack = 0,
  priorGate = 0,
}: {
  swapBack?: number
  priorGate?: number
}) {
  return (
    <td className="px-0 py-2 w-7.5">
      <WaitBadge
        swapBack={swapBack}
        priorGate={priorGate}
        className="-ml-1.5"
      />
    </td>
  )
}

/** Trailing duration cell. */
export function DurationCell({ frames }: { frames: number }) {
  return (
    <td className="px-2 py-2 text-right font-mono text-label text-gray-300">
      {formatFrames(frames)}
    </td>
  )
}

/** Concerto/resonance pool cell. `stale` dims the entry row when the log is out of date. */
export function PoolCell({
  value,
  color,
  stale,
}: {
  value: number | null
  color: string
  stale?: boolean
}) {
  return (
    <td
      className={`px-2 py-2 text-right font-mono${stale ? " opacity-40" : ""}`}
    >
      <PoolValue value={value} color={color} />
    </td>
  )
}
