import { useRef } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { clampPoint, translateCalibration } from "../calibration"
import type { Calibration, Point } from "../calibration"

/**
 * The forte gauge calibration, overlaid on the video canvas: a bar with a move
 * handle and two draggable endpoints (`empty`, `full`). Coords are normalized
 * [0,1] against the canvas box, so the 50%/100% toggle and window resize leave
 * the bar on the gauge. Pointer positions convert through the box rect only here.
 */
export function CalibrationOverlay({
  calibration,
  onChange,
}: {
  calibration: Calibration
  onChange: (cal: Calibration) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const lastNorm = useRef<Point | null>(null)

  function normFromEvent(e: ReactPointerEvent): Point | null {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  function dragEndpoint(which: "empty" | "full") {
    return (e: ReactPointerEvent) => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      const move = (ev: PointerEvent) => {
        const p = normFromEvent(ev as unknown as ReactPointerEvent)
        if (p) onChange({ ...calibration, [which]: clampPoint(p) })
      }
      const up = () => {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
    }
  }

  function dragBox(e: ReactPointerEvent) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    lastNorm.current = normFromEvent(e)
    const move = (ev: PointerEvent) => {
      const p = normFromEvent(ev as unknown as ReactPointerEvent)
      const prev = lastNorm.current
      if (!p || !prev) return
      onChange(translateCalibration(calibration, p.x - prev.x, p.y - prev.y))
      lastNorm.current = p
    }
    const up = () => {
      lastNorm.current = null
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const mid = {
    x: (calibration.empty.x + calibration.full.x) / 2,
    y: (calibration.empty.y + calibration.full.y) / 2,
  }
  const pct = (v: number) => `${v * 100}%`

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
          stroke="rgb(56 189 248)"
          strokeWidth={0.006}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <Handle
        point={mid}
        pct={pct}
        onPointerDown={dragBox}
        className="cursor-move rounded-sm border border-sky-400 bg-sky-400/30"
        title="move the whole bar"
      />
      <Endpoint
        point={calibration.empty}
        pct={pct}
        onPointerDown={dragEndpoint("empty")}
        className="border-sky-400 bg-background"
        label="0"
      />
      <Endpoint
        point={calibration.full}
        pct={pct}
        onPointerDown={dragEndpoint("full")}
        className="border-sky-400 bg-sky-400"
        label="max"
      />
    </div>
  )
}

function Handle({
  point,
  pct,
  onPointerDown,
  className,
  title,
}: {
  point: Point
  pct: (v: number) => string
  onPointerDown: (e: ReactPointerEvent) => void
  className: string
  title: string
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      title={title}
      style={{ left: pct(point.x), top: pct(point.y) }}
      className={`absolute size-4 -translate-x-1/2 -translate-y-1/2 ${className}`}
    />
  )
}

function Endpoint({
  point,
  pct,
  onPointerDown,
  className,
  label,
}: {
  point: Point
  pct: (v: number) => string
  onPointerDown: (e: ReactPointerEvent) => void
  className: string
  label: string
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{ left: pct(point.x), top: pct(point.y) }}
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab"
    >
      <div className={`size-3 rounded-full border-2 ${className}`} />
      <span className="absolute left-1/2 top-4 -translate-x-1/2 font-mono text-[10px] text-sky-300">
        {label}
      </span>
    </div>
  )
}
