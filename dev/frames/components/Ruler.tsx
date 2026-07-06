import { X } from "lucide-react"
import { CUE_COLOR } from "../shared"
import type { Selected } from "../shared"
import { exceedingHitIds, isPlaceholder, sections } from "../types"
import type { Clip, ClipEdit } from "../types"
import { FrameTrack, TrackMarker, TrackRegion } from "./FrameTrack"

export function Ruler({
  clip,
  selected,
  setSelected,
  onEdit,
  playhead,
  onSeek,
}: {
  clip: Clip
  selected: Selected
  setSelected: (s: Selected) => void
  onEdit: (edit: ClipEdit) => Clip
  playhead?: number
  onSeek?: (frame: number) => void
}) {
  const locked = clip.stagesLocked ?? false
  const secs = sections(clip)
  const exceeding = exceedingHitIds(clip)

  return (
    <FrameTrack
      lo={clip.start}
      hi={clip.end}
      onScrub={onSeek}
      className="relative h-22 cursor-ew-resize select-none rounded border border-border bg-border"
    >
      {secs.map((sec, i) => {
        const ph = isPlaceholder(sec.ref)
        return (
          <TrackRegion
            key={i}
            start={sec.start}
            end={sec.end}
            className={`absolute top-0 flex h-full flex-col items-center justify-center overflow-hidden border-r border-border ${ph ? "" : i % 2 ? "bg-border/40" : "bg-border/20"}`}
            style={
              ph
                ? {
                    background:
                      "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-muted-foreground) 15%, transparent) 0 8px, transparent 8px 16px)",
                  }
                : undefined
            }
          >
            {!locked && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onEdit({ type: "removeStage", index: i })}
                className="absolute right-1 top-1 text-muted-foreground/60 hover:text-destructive"
                title={ph ? "remove spacer" : "remove stage"}
              >
                <X className="size-3" />
              </button>
            )}
            {ph ? (
              <span className="px-1 text-micro uppercase tracking-[1px] text-muted-foreground/70">
                spacer
              </span>
            ) : (
              <>
                <span className="max-w-full truncate px-1 text-label font-medium text-foreground">
                  {sec.ref.skill}
                </span>
                {sec.ref.stage !== sec.ref.skill && (
                  <span className="max-w-full truncate px-1 text-detail text-muted-foreground">
                    {sec.ref.stage}
                  </span>
                )}
              </>
            )}
            <span className="font-mono text-detail tabular-nums text-muted-foreground/70">
              {sec.end - sec.start}f
            </span>
          </TrackRegion>
        )
      })}

      {clip.restStart != null && clip.restStart < clip.end && (
        <>
          <TrackRegion
            start={clip.restStart}
            end={clip.end}
            className="absolute top-0 h-full"
            style={{
              background:
                "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-muted-foreground) 15%, transparent) 0 8px, transparent 8px 16px)",
            }}
          >
            <span className="absolute left-1 top-1 font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
              end
            </span>
            {!locked && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onEdit({ type: "removeRestZone" })}
                className="absolute right-1 top-1 z-20 text-muted-foreground/60 hover:text-destructive"
                title="remove rest zone (last stage expands to the end)"
              >
                <X className="size-3" />
              </button>
            )}
          </TrackRegion>
          <TrackMarker
            frame={clip.restStart}
            onDrag={locked ? undefined : onSeek}
            onCommit={
              locked
                ? undefined
                : (frame) => onEdit({ type: "moveRestStart", frame })
            }
            className={`absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 items-stretch justify-center ${locked ? "" : "cursor-ew-resize"}`}
            title={`rest starts @ ${clip.restStart}`}
          >
            <div className="w-0.5 bg-muted-foreground/50" />
          </TrackMarker>
        </>
      )}

      {clip.boundaries.map((b, i) => (
        <TrackMarker
          key={b.id}
          frame={b.frame}
          onSelect={() => setSelected({ type: "boundary", id: b.id })}
          onDrag={locked ? undefined : onSeek}
          onCommit={
            locked
              ? undefined
              : (frame) => onEdit({ type: "moveBoundary", index: i, frame })
          }
          className={`absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 items-stretch justify-center ${locked ? "cursor-pointer" : "cursor-ew-resize"}`}
          title={`boundary @ ${b.frame} (${b.cue})`}
        >
          <div className={`w-0.5 ${CUE_COLOR[b.cue]}`} />
        </TrackMarker>
      ))}

      {(clip.animationSplits ?? []).map((split, i) =>
        !split ? null : (
          <TrackMarker
            key={`split-${i}`}
            frame={split.frame}
            onSelect={() => setSelected({ type: "split", index: i })}
            onDrag={onSeek}
            onCommit={(frame) =>
              onEdit({ type: "moveAnimationSplit", stageIndex: i, frame })
            }
            className="absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 cursor-ew-resize flex-col items-center"
            title={`animation split @ ${split.frame} (${split.cue})`}
          >
            <div className={`size-1.5 rotate-45 ${CUE_COLOR[split.cue]}`} />
            <div
              className={`w-0.5 flex-1 opacity-70 ${CUE_COLOR[split.cue]}`}
            />
          </TrackMarker>
        ),
      )}

      {clip.hits.map((h) => (
        <TrackMarker
          key={h.id}
          frame={h.frame}
          onSelect={() => setSelected({ type: "hit", id: h.id })}
          onDrag={onSeek}
          onCommit={(frame) => onEdit({ type: "moveHit", id: h.id, frame })}
          className="absolute bottom-2 z-20 -translate-x-1/2 cursor-grab"
          title={`hit @ ${h.frame} (${h.cue})`}
        >
          <div
            className={`size-3.5 rounded-full ${exceeding.has(h.id) ? "border-2 border-destructive" : "border border-background"} ${CUE_COLOR[h.cue]} ${selected?.type === "hit" && selected.id === h.id ? "ring-2 ring-foreground" : ""}`}
          />
        </TrackMarker>
      ))}

      {playhead != null && playhead >= clip.start && playhead <= clip.end && (
        <TrackMarker
          frame={playhead}
          className="pointer-events-none absolute top-0 z-30 h-full w-px -translate-x-1/2 bg-foreground"
        />
      )}

      <span className="pointer-events-none absolute bottom-0.5 left-1 font-mono text-detail text-muted-foreground/60">
        {clip.start}
      </span>
      <span className="pointer-events-none absolute bottom-0.5 right-1 font-mono text-detail text-muted-foreground/60">
        {clip.end}
      </span>
    </FrameTrack>
  )
}
