import { clamp } from "../frames/shared"

/** Normalized [0,1] point in video-frame space, never display pixels. */
export interface Point {
  x: number
  y: number
}

/** The linear `empty→full` axis a separator's fill reads against. */
export interface Calibration {
  empty: Point
  full: Point
}

// A horizontal bar low in the frame: a visible starting guess to drag onto the gauge.
export const DEFAULT_CALIBRATION: Calibration = {
  empty: { x: 0.35, y: 0.9 },
  full: { x: 0.65, y: 0.9 },
}

export const clamp01 = (v: number) => clamp(v, 0, 1)

export function clampPoint(p: Point): Point {
  return { x: clamp01(p.x), y: clamp01(p.y) }
}

/**
 * Where `p` falls along the `empty→full` axis, as a fraction clamped to [0,1].
 * Projects onto the line, so an off-axis fill-drag still reads a gauge level.
 * Re-calibrating the bar reflows this, keeping the reading pinned to the pixel.
 */
export function fillFractionAt(cal: Calibration, p: Point): number {
  const ax = cal.full.x - cal.empty.x
  const ay = cal.full.y - cal.empty.y
  const len2 = ax * ax + ay * ay
  if (len2 === 0) return 0
  const t = ((p.x - cal.empty.x) * ax + (p.y - cal.empty.y) * ay) / len2
  return clamp01(t)
}

/**
 * Shift both endpoints by (dx, dy), backing the delta off so neither leaves the
 * frame. Moving as a unit preserves the bar's length and angle.
 */
export function translateCalibration(
  cal: Calibration,
  dx: number,
  dy: number,
): Calibration {
  const xs = [cal.empty.x, cal.full.x]
  const ys = [cal.empty.y, cal.full.y]
  const cx = clamp(dx, -Math.min(...xs), 1 - Math.max(...xs))
  const cy = clamp(dy, -Math.min(...ys), 1 - Math.max(...ys))
  return {
    empty: { x: cal.empty.x + cx, y: cal.empty.y + cy },
    full: { x: cal.full.x + cx, y: cal.full.y + cy },
  }
}
