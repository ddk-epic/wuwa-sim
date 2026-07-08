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
