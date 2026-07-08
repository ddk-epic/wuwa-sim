import type { PointerEvent as ReactPointerEvent } from "react"
import type { Calibration } from "../calibration"

export const BAR_HEIGHT_PX = 36

const pct = (v: number) => `${v * 100}%`

// The calibrated gauge rectangle: white-bordered, transparent, axis-aligned off
// empty.y. Interactive when given onPointerDown, otherwise a static reference.
export function BarOutline({
  calibration,
  onPointerDown,
  title,
}: {
  calibration: Calibration
  onPointerDown?: (e: ReactPointerEvent) => void
  title?: string
}) {
  const left = Math.min(calibration.empty.x, calibration.full.x)
  const width = Math.abs(calibration.full.x - calibration.empty.x)
  return (
    <div
      onPointerDown={onPointerDown}
      title={title}
      style={{
        left: pct(left),
        top: pct(calibration.empty.y),
        width: pct(width),
        height: BAR_HEIGHT_PX,
      }}
      className={`absolute -translate-y-1/2 rounded-sm border-2 border-white ${onPointerDown ? "cursor-move" : "pointer-events-none"}`}
    />
  )
}
