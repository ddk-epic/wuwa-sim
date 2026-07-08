import { useRef } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { clamp01, translateCalibration } from "../calibration"
import type { Calibration, Point } from "../calibration"

const BAR_HEIGHT_PX = 36

/**
 * The forte gauge calibration, overlaid on the video canvas: a white-bordered
 * rectangle you drag as a unit, with two endpoints (`empty`, `full`) that slide
 * horizontally along the gauge. Coords are normalized [0,1] against the canvas
 * box, so the 50%/100% toggle and window resize leave the bar on the gauge.
 * Pointer positions convert through the box rect only here.
 */
export function CalibrationOverlay({
  calibration,
  onChange,
}: {
  calibration: Calibration
  onChange: (cal: Calibration) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  // Handlers captured at pointerdown read the live value, not the render's stale one.
  const calRef = useRef(calibration)
  calRef.current = calibration

  function normFromEvent(e: PointerEvent): Point | null {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  function drag(
    e: ReactPointerEvent,
    onMove: (start: Calibration, from: Point, to: Point) => void,
  ) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const startCal = calRef.current
    const startNorm = normFromEvent(e.nativeEvent)
    if (!startNorm) return
    const move = (ev: PointerEvent) => {
      const to = normFromEvent(ev)
      if (to) onMove(startCal, startNorm, to)
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const dragBox = (e: ReactPointerEvent) =>
    drag(e, (start, from, to) =>
      onChange(translateCalibration(start, to.x - from.x, to.y - from.y)),
    )

  // Endpoints slide along the gauge only: x follows the pointer, y stays put.
  const dragEndpoint = (which: "empty" | "full") => (e: ReactPointerEvent) =>
    drag(e, (start, _from, to) =>
      onChange({ ...start, [which]: { x: clamp01(to.x), y: start[which].y } }),
    )

  const left = Math.min(calibration.empty.x, calibration.full.x)
  const width = Math.abs(calibration.full.x - calibration.empty.x)
  const pct = (v: number) => `${v * 100}%`

  return (
    <div ref={boxRef} className="absolute inset-0 touch-none select-none">
      <div
        onPointerDown={dragBox}
        title="drag to move the whole bar"
        style={{
          left: pct(left),
          top: pct(calibration.empty.y),
          width: pct(width),
          height: BAR_HEIGHT_PX,
        }}
        className="absolute -translate-y-1/2 cursor-move rounded-sm border-2 border-white"
      />
      <Wall
        x={calibration.empty.x}
        y={calibration.empty.y}
        pct={pct}
        onPointerDown={dragEndpoint("empty")}
      />
      <Wall
        x={calibration.full.x}
        y={calibration.full.y}
        pct={pct}
        onPointerDown={dragEndpoint("full")}
      />
    </div>
  )
}

// Transparent hit strip over a left/right wall; drag it to slide that endpoint.
function Wall({
  x,
  y,
  pct,
  onPointerDown,
}: {
  x: number
  y: number
  pct: (v: number) => string
  onPointerDown: (e: ReactPointerEvent) => void
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{ left: pct(x), top: pct(y), height: BAR_HEIGHT_PX + 8 }}
      className="absolute w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
    />
  )
}
