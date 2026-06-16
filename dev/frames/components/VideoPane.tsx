import { useEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  Upload,
} from "lucide-react"
import { TRACK_COLS } from "../shared"
import { ENGINE_FPS, openVideoSource } from "../video"
import type { VideoSource } from "../video"

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

/**
 * The frame viewer + transport. Canvas on top (full width), then a stepper/scrub
 * track that aligns with the ruler below via `TRACK_COLS`. In `scoping`, the scrub
 * grows in/out cut handles over the whole recording and a Lock-in (normalize) bar;
 * otherwise it's a plain playhead scrub over the clip. The recording is throwaway.
 */
export function VideoPane({
  source,
  videoFrame,
  playhead,
  setPlayhead,
  lo,
  hi,
  scoping,
  inCut,
  outCut,
  onSetIn,
  onSetOut,
  onLock,
  onAttach,
  storedSource,
}: {
  source: VideoSource | null
  videoFrame: number
  playhead: number
  setPlayhead: (f: number) => void
  lo: number
  hi: number
  scoping: boolean
  inCut: number
  outCut: number
  onSetIn: (f: number) => void
  onSetOut: (f: number) => void
  onLock: () => void
  onAttach: (s: VideoSource) => void
  storedSource?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [half, setHalf] = useState(false)
  const mounted = useRef(true)
  useEffect(() => () => void (mounted.current = false), [])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d")
    if (source && ctx) void source.drawFrame(videoFrame, ctx)
  }, [source, videoFrame])

  async function attach(file: File) {
    setBusy(true)
    setError(null)
    try {
      const source = await openVideoSource(file)
      // A clip switch can unmount us mid-decode; the resolved source would never
      // reach state, so the owner's dispose-on-replace effect can't reclaim it.
      if (mounted.current) onAttach(source)
      else source.dispose()
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Could not read this file.")
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  if (!source) {
    return (
      <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-gray-700 text-sm text-muted-foreground hover:border-muted-foreground hover:text-foreground">
        <Upload className="size-5" />
        {busy ? "Reading…" : "Attach recording (.mp4) to step frames"}
        {storedSource && (
          <span className="font-mono text-detail text-muted-foreground/60">
            measured against {storedSource}
          </span>
        )}
        {error && <span className="text-detail text-destructive">{error}</span>}
        <input
          type="file"
          accept="video/mp4,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void attach(f)
          }}
        />
      </label>
    )
  }

  const step = (delta: number) => setPlayhead(clamp(playhead + delta, lo, hi))
  const fpsOff = Math.abs(source.fps - ENGINE_FPS) > 1

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 font-mono text-detail text-muted-foreground/70">
        <span className="truncate">{source.fileName}</span>
        <div className="flex items-center gap-3">
          <span className={fpsOff ? "text-destructive" : ""}>
            {source.fps.toFixed(2)}fps · {source.frameCount}f
          </span>
          <button
            onClick={() => setHalf((h) => !h)}
            className="rounded border border-border px-1.5 hover:border-muted-foreground hover:text-foreground"
            title="toggle canvas size"
          >
            {half ? "50%" : "100%"}
          </button>
        </div>
      </div>
      {fpsOff && (
        <p className="text-detail text-destructive">
          Recording isn’t ~60fps — frame numbers won’t match engine frames 1:1.
        </p>
      )}
      <div className={half ? "mx-auto w-1/2" : ""}>
        <canvas
          ref={canvasRef}
          className="w-full rounded border border-border bg-black"
        />
      </div>

      <div className={`${TRACK_COLS} items-center`}>
        <div className="flex items-center gap-0.5">
          <StepButton onClick={() => step(-10)} title="−10 frames">
            <ChevronsLeft className="size-4" />
          </StepButton>
          <StepButton onClick={() => step(-1)} title="−1 frame">
            <ChevronLeft className="size-4" />
          </StepButton>
          <span className="min-w-[4ch] text-center font-mono text-sm tabular-nums">
            {playhead}
          </span>
          <StepButton onClick={() => step(1)} title="+1 frame">
            <ChevronRight className="size-4" />
          </StepButton>
          <StepButton onClick={() => step(10)} title="+10 frames">
            <ChevronsRight className="size-4" />
          </StepButton>
        </div>
        <Scrub
          playhead={playhead}
          setPlayhead={setPlayhead}
          lo={lo}
          hi={hi}
          scoping={scoping}
          inCut={inCut}
          outCut={outCut}
          onSetIn={onSetIn}
          onSetOut={onSetOut}
        />
      </div>

      {scoping && (
        <div className="flex flex-wrap items-center gap-3 text-detail">
          <span className="font-mono text-muted-foreground/70">
            drag the handles to the action’s bounds — in {inCut} · out {outCut}{" "}
            · span {Math.max(0, outCut - inCut)}f
          </span>
          <button
            onClick={onLock}
            className="ml-auto flex items-center gap-1 rounded border border-primary bg-primary px-3 py-0.5 text-primary-foreground hover:opacity-90"
          >
            <Lock className="size-3.5" /> Lock in
          </button>
        </div>
      )}
    </div>
  )
}

function Scrub({
  playhead,
  setPlayhead,
  lo,
  hi,
  scoping,
  inCut,
  outCut,
  onSetIn,
  onSetOut,
}: {
  playhead: number
  setPlayhead: (f: number) => void
  lo: number
  hi: number
  scoping: boolean
  inCut: number
  outCut: number
  onSetIn: (f: number) => void
  onSetOut: (f: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const span = Math.max(1, hi - lo)
  const pct = (f: number) => ((f - lo) / span) * 100
  const frameAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect()
    return Math.round(lo + ((clientX - rect.left) / rect.width) * span)
  }

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        setPlayhead(clamp(frameAt(e.clientX), lo, hi))
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (e.buttons) setPlayhead(clamp(frameAt(e.clientX), lo, hi))
      }}
      className="relative h-6 cursor-ew-resize rounded border border-border bg-border/30"
    >
      {scoping && (
        <>
          <div
            className="absolute top-0 h-full bg-primary/15"
            style={{
              left: `${pct(inCut)}%`,
              width: `${pct(outCut) - pct(inCut)}%`,
            }}
          />
          <CutHandle
            pos={pct(inCut)}
            onDrag={(x) => {
              const f = frameAt(x)
              onSetIn(f)
              setPlayhead(clamp(f, lo, hi))
            }}
          />
          <CutHandle
            pos={pct(outCut)}
            onDrag={(x) => {
              const f = frameAt(x)
              onSetOut(f)
              setPlayhead(clamp(f, lo, hi))
            }}
          />
        </>
      )}
      <div
        className="pointer-events-none absolute top-0 h-full w-px -translate-x-1/2 bg-foreground"
        style={{ left: `${pct(clamp(playhead, lo, hi))}%` }}
      />
    </div>
  )
}

function CutHandle({
  pos,
  onDrag,
}: {
  pos: number
  onDrag: (clientX: number) => void
}) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (e.buttons) onDrag(e.clientX)
      }}
      className="absolute top-0 z-10 flex h-full w-2.5 -translate-x-1/2 cursor-ew-resize items-stretch justify-center"
      style={{ left: `${pos}%` }}
    >
      <div className="w-0.5 bg-primary" />
    </div>
  )
}

function StepButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded border border-border p-1 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  )
}
