import { createContext, useContext, useRef } from "react"
import type { CSSProperties, ReactNode } from "react"
import { clamp } from "../shared"

/** Frame → percent across the `[lo, hi]` span. */
export const frameToPct = (frame: number, lo: number, hi: number) =>
  ((frame - lo) / Math.max(1, hi - lo)) * 100

/** Pixel → frame, rounded and clamped to `[lo, hi]`. */
export const frameAtClientX = (
  clientX: number,
  rect: DOMRect,
  lo: number,
  hi: number,
) =>
  clamp(
    Math.round(lo + ((clientX - rect.left) / rect.width) * (hi - lo)),
    lo,
    hi,
  )

interface FrameTrackContext {
  pct: (frame: number) => number
  frameAt: (clientX: number) => number
}

const Ctx = createContext<FrameTrackContext | null>(null)

function useFrameTrack(): FrameTrackContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useFrameTrack must be used within a FrameTrack")
  return ctx
}

// The one place pixels↔frames live. Descendants place themselves in frame space
// via TrackMarker/TrackRegion; onScrub makes the whole box a draggable seek.
export function FrameTrack({
  lo,
  hi,
  onScrub,
  className,
  children,
}: {
  lo: number
  hi: number
  onScrub?: (frame: number) => void
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const pct = (frame: number) => frameToPct(frame, lo, hi)
  const frameAt = (clientX: number) =>
    frameAtClientX(clientX, ref.current!.getBoundingClientRect(), lo, hi)

  return (
    <div
      ref={ref}
      onPointerDown={
        onScrub &&
        ((e) => {
          e.stopPropagation()
          onScrub(frameAt(e.clientX))
          e.currentTarget.setPointerCapture(e.pointerId)
        })
      }
      onPointerMove={
        onScrub &&
        ((e) => {
          if (e.buttons) onScrub(frameAt(e.clientX))
        })
      }
      className={className}
    >
      <Ctx.Provider value={{ pct, frameAt }}>{children}</Ctx.Provider>
    </div>
  )
}

// A point at `frame`. Draggable iff `onDrag` given; `onSelect` is press-to-select
// independent of drag, so a locked-but-selectable mark passes onSelect without
// onDrag. Owns horizontal placement only; the caller styles the rest.
export function TrackMarker({
  frame,
  onDrag,
  onSelect,
  className,
  style,
  title,
  children,
}: {
  frame: number
  onDrag?: (frame: number) => void
  onSelect?: () => void
  className?: string
  style?: CSSProperties
  title?: string
  children?: ReactNode
}) {
  const { pct, frameAt } = useFrameTrack()
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect?.()
        if (onDrag) e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={
        onDrag &&
        ((e) => {
          if (e.buttons) onDrag(frameAt(e.clientX))
        })
      }
      className={className}
      style={{ left: `${pct(frame)}%`, ...style }}
      title={title}
    >
      {children}
    </div>
  )
}

/** An interval `[start, end]` on the track. */
export function TrackRegion({
  start,
  end,
  className,
  style,
  children,
}: {
  start: number
  end: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  const { pct } = useFrameTrack()
  return (
    <div
      className={className}
      style={{
        left: `${pct(start)}%`,
        width: `${pct(end) - pct(start)}%`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
