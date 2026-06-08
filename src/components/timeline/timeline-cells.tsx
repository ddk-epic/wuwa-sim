import { formatFrames } from "#/lib/format"
import { PoolValue } from "../ui/PoolValue"

/** Vertical padding shared by the timeline column: entry rows py-2, dense group header py-1.5. */
function pad(dense?: boolean): string {
  return dense ? "py-1.5" : "py-2"
}

/** Leading time cell, accented in the damage color. */
export function TimeCell({
  frames,
  dense,
}: {
  frames: number
  dense?: boolean
}) {
  return (
    <td
      className={`px-2 ${pad(dense)} text-right font-mono text-label text-ui-damage`}
    >
      {formatFrames(frames)}
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
