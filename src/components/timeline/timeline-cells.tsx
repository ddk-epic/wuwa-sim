import { formatFrames } from "#/lib/format"
import { PoolValue } from "../ui/PoolValue"
import { WaitBadge } from "../ui/WaitBadge"

/** Vertical padding shared by the timeline column: entry rows py-2, dense group header py-1.5. */
function pad(dense?: boolean): string {
  return dense ? "py-1.5" : "py-2"
}

/**
 * Leading time cell, accented in the damage color. The prior-gate `WaitBadge`
 * sits in a fixed-width reserved slot right of the time so the value never
 * shifts when a wait appears.
 */
export function TimeCell({
  frames,
  dense,
  priorGate = 0,
}: {
  frames: number
  dense?: boolean
  priorGate?: number
}) {
  return (
    <td
      className={`px-2 ${pad(dense)} text-right font-mono text-label text-ui-damage`}
    >
      {formatFrames(frames)}
      <span className="inline-block w-10 text-left align-baseline font-sans">
        <WaitBadge priorGate={priorGate} className="ml-1" />
      </span>
    </td>
  )
}

/** Trailing duration cell. */
export function DurationCell({
  frames,
  dense,
}: {
  frames: number
  dense?: boolean
}) {
  return (
    <td
      className={`px-2 ${pad(dense)} text-right font-mono text-label text-gray-300`}
    >
      {formatFrames(frames)}
    </td>
  )
}

/** Concerto/resonance pool cell. `stale` dims the entry row when the log is out of date. */
export function PoolCell({
  value,
  color,
  dense,
  stale,
}: {
  value: number | null
  color: string
  dense?: boolean
  stale?: boolean
}) {
  return (
    <td
      className={`px-2 ${pad(dense)} text-right font-mono${stale ? " opacity-40" : ""}`}
    >
      <PoolValue value={value} color={color} />
    </td>
  )
}
