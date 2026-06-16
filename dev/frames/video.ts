import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny"

/** Engine and recording frame rate. Both are 60fps, so a video frame is an engine frame 1:1. */
export const ENGINE_FPS = 60

/**
 * A decoded view over one re-attached recording — throwaway, never persisted.
 * Frame indices are engine frames (== video frames at 60fps CFR). `drawFrame`
 * does mediabunny's keyframe-seek-and-decode-forward internally, so stepping is
 * frame-accurate rather than `currentTime`-approximate. Disposed on clip switch.
 */
export interface VideoSource {
  fileName: string
  frameCount: number
  /** Container-reported rate; verified against `ENGINE_FPS` by the caller. */
  fps: number
  drawFrame: (frame: number, ctx: CanvasRenderingContext2D) => Promise<void>
  dispose: () => void
}

export async function openVideoSource(file: File): Promise<VideoSource> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  })
  // Any failure between here and the returned handle must dispose `input`, or the
  // decode pipeline (and the BlobSource over the File) leaks — a corrupt or
  // unsupported mp4 reaches the stats/sink steps, not just the no-track branch.
  let stats, sink
  try {
    const track = await input.getPrimaryVideoTrack()
    if (!track) throw new Error("No video track found in this file.")
    stats = await track.computePacketStats()
    sink = new CanvasSink(track)
  } catch (e) {
    input.dispose()
    throw e
  }
  // Held on an object so the post-await guard reads a live boolean — `dispose`
  // may fire (clip switch) while a decode is in flight.
  const state = { disposed: false }

  return {
    fileName: file.name,
    frameCount: stats.packetCount,
    fps: stats.averagePacketRate,
    async drawFrame(frame, ctx) {
      // Sample mid-interval so the seek never lands on the boundary between two
      // frames' presentation windows: frame n occupies [n/60, (n+1)/60).
      const wrapped = await sink.getCanvas((frame + 0.5) / ENGINE_FPS)
      // Bail if disposed mid-decode (clip switch) — drawing into a torn-down
      // pipeline's canvas would be wasted work.
      if (!wrapped || state.disposed) return
      const { canvas } = wrapped
      if (ctx.canvas.width !== canvas.width) ctx.canvas.width = canvas.width
      if (ctx.canvas.height !== canvas.height) ctx.canvas.height = canvas.height
      ctx.drawImage(canvas, 0, 0)
    },
    dispose() {
      state.disposed = true
      input.dispose()
    },
  }
}
