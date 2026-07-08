import { useRef } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { clamp01, fillFractionAt } from "../calibration"
import type { Calibration, Point } from "../calibration"
import { BAR_HEIGHT_PX, BarOutline } from "./BarOutline"

/**
 * The calibrated bar as a static reference, plus an optional divider marking the
 * gauge fill edge. With `onChange` the divider drags (x-only, y pinned to the
 * bar); `readOnly` draws it fixed. Omit `fill` to draw the bar alone. The
 * divider's projected fraction is the slot's reading.
 */
export function FillOverlay({
  calibration,
  fill,
  onChange,
  readOnly,
}: {
  calibration: Calibration
  fill?: Point
  onChange?: (fill: Point) => void
  readOnly?: boolean
}) {
  const boxRef = useRef<HTMLDivElement>(null)

  function drag(e: ReactPointerEvent) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const rect = boxRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return
      // x-only: y stays pinned to the bar.
      onChange?.({
        x: clamp01((ev.clientX - rect.left) / rect.width),
        y: calibration.empty.y,
      })
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const pct = (v: number) => `${v * 100}%`

  return (
    <div ref={boxRef} className="absolute inset-0 touch-none select-none">
      <BarOutline calibration={calibration} />
      {fill && (
        <div
          style={{ left: pct(fill.x), top: pct(calibration.empty.y) }}
          className="absolute -translate-x-1/2"
        >
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 w-px -translate-x-1/2 -translate-y-1/2 bg-amber-400"
            style={{ height: BAR_HEIGHT_PX }}
          />
          <span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/60 px-1 font-mono text-[10px] tabular-nums text-amber-300"
            style={{ bottom: BAR_HEIGHT_PX / 2 + 2 }}
          >
            {(fillFractionAt(calibration, fill) * 100).toFixed(1)}%
          </span>
          <div
            className="pointer-events-none absolute left-1/2 size-3 -translate-x-1/2 rounded-sm border border-white bg-amber-400"
            style={{ top: BAR_HEIGHT_PX / 2 + 2 }}
          />
          {!readOnly && (
            <div
              onPointerDown={drag}
              title="drag to the gauge's fill edge"
              className="absolute left-1/2 w-3 -translate-x-1/2 cursor-ew-resize"
              style={{ top: -BAR_HEIGHT_PX / 2, height: BAR_HEIGHT_PX + 16 }}
            />
          )}
        </div>
      )}
    </div>
  )
}
