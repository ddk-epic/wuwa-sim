import { useEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  Upload,
} from "lucide-react"
import { TRACK_COLS, clamp } from "../shared"
import { ENGINE_FPS, openVideoSource } from "../video"
import type { VideoSource } from "../video"
import { FrameTrack, TrackMarker, TrackRegion } from "./FrameTrack"

const ATTACH_TIMEOUT_MS = 10_000
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

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
  overlay,
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
  /** Positioned over the canvas, sharing its box exactly. */
  overlay?: React.ReactNode
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [half, setHalf] = useState(false)
  const mounted = useRef(true)
  // Set on setup, not just init, else a Fast Refresh cleanup leaves it stuck false.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Latest-wins scrub: one decode in flight, stale frames dropped to avoid backlog lag.
  const pendingFrame = useRef<number | null>(null)
  const drawing = useRef(false)
  const sourceRef = useRef(source)
  sourceRef.current = source

  useEffect(() => {
    if (!source) return
    pendingFrame.current = videoFrame
    if (drawing.current) return
    drawing.current = true
    void (async () => {
      const ctx = canvasRef.current?.getContext("2d")
      while (ctx && pendingFrame.current !== null) {
        const frame = pendingFrame.current
        pendingFrame.current = null
        const s = sourceRef.current
        if (!s) break
        await s.drawFrame(frame, ctx)
      }
      drawing.current = false
    })()
  }, [source, videoFrame])

  async function attach(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `That file is ${(file.size / 1024 / 1024).toFixed(0)}MB — over the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit. Trim or re-encode it first.`,
      )
      return
    }
    setBusy(true)
    setError(null)
    let timer: ReturnType<typeof setTimeout> | undefined
    const open = openVideoSource(file)
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            "Reading this recording timed out. Try a shorter clip or re-encode it as H.264 mp4.",
          ),
        )
      }, ATTACH_TIMEOUT_MS)
    })
    try {
      const opened = await Promise.race([open, deadline])
      // A clip switch can unmount us mid-decode; the resolved source would never
      // reach state, so the owner's dispose-on-replace effect can't reclaim it.
      if (mounted.current) onAttach(opened)
      else opened.dispose()
    } catch (e) {
      // Whatever rejected, a source that resolves afterward still needs freeing.
      void open.then((s) => s.dispose()).catch(() => {})
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Could not read this file.")
    } finally {
      clearTimeout(timer)
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
            // Clear so re-picking the same file re-fires change.
            e.target.value = ""
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
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full rounded border border-border bg-black"
          />
          {overlay}
        </div>
      </div>

      <div className={`${TRACK_COLS} items-center`}>
        <div className="flex items-center gap-0.75">
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
  const cutHandle =
    "absolute top-0 z-10 flex h-full w-2.5 -translate-x-1/2 cursor-ew-resize items-stretch justify-center"

  return (
    <FrameTrack
      lo={lo}
      hi={hi}
      onScrub={setPlayhead}
      className="relative h-6 cursor-ew-resize rounded border border-border bg-border/30"
    >
      {scoping && (
        <>
          <TrackRegion
            start={inCut}
            end={outCut}
            className="absolute top-0 h-full bg-primary/15"
          />
          <TrackMarker
            frame={inCut}
            onDrag={setPlayhead}
            onCommit={onSetIn}
            className={cutHandle}
          >
            <div className="w-0.5 bg-primary" />
          </TrackMarker>
          <TrackMarker
            frame={outCut}
            onDrag={setPlayhead}
            onCommit={onSetOut}
            className={cutHandle}
          >
            <div className="w-0.5 bg-primary" />
          </TrackMarker>
        </>
      )}
      <TrackMarker
        frame={clamp(playhead, lo, hi)}
        className="pointer-events-none absolute top-0 h-full w-px -translate-x-1/2 bg-foreground"
      />
    </FrameTrack>
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
