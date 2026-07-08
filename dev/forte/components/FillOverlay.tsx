import { useRef } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { clampPoint, fillFractionAt } from "../calibration"
import type { Calibration, Point } from "../calibration"

/**
 * Placement overlay: the calibrated bar drawn for reference plus one draggable
 * fill handle you drop on the gauge's current fill edge. Its projected fraction
 * along the bar becomes a separator's reading. Coords are normalized [0,1].
 */
export function FillOverlay({
  calibration,
  fill,
  onChange,
}: {
  calibration: Calibration
  fill: Point
  onChange: (fill: Point) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)

  function drag(e: ReactPointerEvent) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const rect = boxRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return
      onChange(
        clampPoint({
          x: (ev.clientX - rect.left) / rect.width,
          y: (ev.clientY - rect.top) / rect.height,
        }),
      )
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const pct = (v: number) => `${v * 100}%`
  const fraction = fillFractionAt(calibration, fill)

  return (
    <div ref={boxRef} className="absolute inset-0 touch-none select-none">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1 1"
      >
        <line
          x1={calibration.empty.x}
          y1={calibration.empty.y}
          x2={calibration.full.x}
          y2={calibration.full.y}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        onPointerDown={drag}
        title="drag to the gauge's fill edge"
        style={{ left: pct(fill.x), top: pct(fill.y) }}
        className="absolute size-4 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-amber-400"
      >
        <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded bg-black/60 px-1 font-mono text-[10px] tabular-nums text-amber-300">
          {(fraction * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  )
}
