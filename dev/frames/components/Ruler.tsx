import { useRef } from "react"
import { X } from "lucide-react"
import { CUE_COLOR } from "../shared"
import type { Selected } from "../shared"
import { exceedingHitIds, isPlaceholder, sections } from "../types"
import type { Clip, ClipEdit } from "../types"

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
  const ref = useRef<HTMLDivElement>(null)
  const locked = clip.stagesLocked ?? false
  const span = Math.max(1, clip.end - clip.start)
  const pct = (f: number) => ((f - clip.start) / span) * 100
  const secs = sections(clip)
  const exceeding = exceedingHitIds(clip)

  function frameAt(clientX: number) {
    const rect = ref.current!.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.round(clip.start + ratio * span)
  }

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSeek?.(frameAt(e.clientX))
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (e.buttons) onSeek?.(frameAt(e.clientX))
      }}
      className="relative h-22 cursor-ew-resize select-none rounded border border-border bg-border"
    >
      {secs.map((sec, i) => {
        const ph = isPlaceholder(sec.ref)
        return (
          <div
            key={i}
            className={`absolute top-0 flex h-full flex-col items-center justify-center overflow-hidden border-r border-border ${ph ? "" : i % 2 ? "bg-border/40" : "bg-border/20"}`}
            style={{
              left: `${pct(sec.start)}%`,
              width: `${pct(sec.end) - pct(sec.start)}%`,
              ...(ph && {
                background:
                  "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-muted-foreground) 15%, transparent) 0 8px, transparent 8px 16px)",
              }),
            }}
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
          </div>
        )
      })}

      {clip.restStart != null && clip.restStart < clip.end && (
        <>
          <div
            className="absolute top-0 h-full"
            style={{
              left: `${pct(clip.restStart)}%`,
              width: `${pct(clip.end) - pct(clip.restStart)}%`,
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
          </div>
          <div
            onPointerDown={(e) => {
              if (locked) return
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!locked && e.buttons)
                onEdit({ type: "moveRestStart", frame: frameAt(e.clientX) })
            }}
            className={`absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 items-stretch justify-center ${locked ? "" : "cursor-ew-resize"}`}
            style={{ left: `${pct(clip.restStart)}%` }}
            title={`rest starts @ ${clip.restStart}`}
          >
            <div className="w-0.5 bg-muted-foreground/50" />
          </div>
        </>
      )}

      {clip.boundaries.map((b, i) => (
        <div
          key={b.id}
          onPointerDown={(e) => {
            e.stopPropagation()
            setSelected({ type: "boundary", id: b.id })
            if (!locked) e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!locked && e.buttons)
              onEdit({
                type: "moveBoundary",
                index: i,
                frame: frameAt(e.clientX),
              })
          }}
          className={`absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 items-stretch justify-center ${locked ? "cursor-pointer" : "cursor-ew-resize"}`}
          style={{ left: `${pct(b.frame)}%` }}
          title={`boundary @ ${b.frame} (${b.cue})`}
        >
          <div className={`w-0.5 ${CUE_COLOR[b.cue]}`} />
        </div>
      ))}

      {(clip.animationSplits ?? []).map((split, i) =>
        !split ? null : (
          <div
            key={`split-${i}`}
            onPointerDown={(e) => {
              e.stopPropagation()
              setSelected({ type: "split", index: i })
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (e.buttons)
                onEdit({
                  type: "moveAnimationSplit",
                  stageIndex: i,
                  frame: frameAt(e.clientX),
                })
            }}
            className="absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 cursor-ew-resize flex-col items-center"
            style={{ left: `${pct(split.frame)}%` }}
            title={`animation split @ ${split.frame} (${split.cue})`}
          >
            <div className={`size-1.5 rotate-45 ${CUE_COLOR[split.cue]}`} />
            <div
              className={`w-0.5 flex-1 opacity-70 ${CUE_COLOR[split.cue]}`}
            />
          </div>
        ),
      )}

      {clip.hits.map((h) => (
        <div
          key={h.id}
          onPointerDown={(e) => {
            e.stopPropagation()
            setSelected({ type: "hit", id: h.id })
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (e.buttons)
              onEdit({ type: "moveHit", id: h.id, frame: frameAt(e.clientX) })
          }}
          className="absolute bottom-2 z-20 -translate-x-1/2 cursor-grab"
          style={{ left: `${pct(h.frame)}%` }}
          title={`hit @ ${h.frame} (${h.cue})`}
        >
          <div
            className={`size-3.5 rounded-full ${exceeding.has(h.id) ? "border-2 border-destructive" : "border border-background"} ${CUE_COLOR[h.cue]} ${selected?.type === "hit" && selected.id === h.id ? "ring-2 ring-foreground" : ""}`}
          />
        </div>
      ))}

      {playhead != null && playhead >= clip.start && playhead <= clip.end && (
        <div
          className="pointer-events-none absolute top-0 z-30 h-full w-px -translate-x-1/2 bg-foreground"
          style={{ left: `${pct(playhead)}%` }}
        />
      )}

      <span className="pointer-events-none absolute bottom-0.5 left-1 font-mono text-detail text-muted-foreground/60">
        {clip.start}
      </span>
      <span className="pointer-events-none absolute bottom-0.5 right-1 font-mono text-detail text-muted-foreground/60">
        {clip.end}
      </span>
    </div>
  )
}
