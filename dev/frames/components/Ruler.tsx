import { useRef } from "react"
import { X } from "lucide-react"
import { CUE_COLOR, uid } from "../shared"
import type { Selected } from "../shared"
import { exceedingHitIds, sections } from "../types"
import type { Clip, ClipEdit, HitMark } from "../types"

export function Ruler({
  clip,
  selected,
  setSelected,
  onEdit,
}: {
  clip: Clip
  selected: Selected
  setSelected: (s: Selected) => void
  onEdit: (edit: ClipEdit) => Clip
}) {
  const ref = useRef<HTMLDivElement>(null)
  const span = Math.max(1, clip.end - clip.start)
  const pct = (f: number) => ((f - clip.start) / span) * 100
  const secs = sections(clip)
  const exceeding = exceedingHitIds(clip)

  function frameAt(clientX: number) {
    const rect = ref.current!.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.round(clip.start + ratio * span)
  }

  function addHit(clientX: number) {
    const h: Omit<HitMark, "owner"> = {
      id: uid(),
      frame: frameAt(clientX),
      cue: "impactFlash",
    }
    const next = onEdit({ type: "addHit", hit: h })
    if (next.hits.some((x) => x.id === h.id))
      setSelected({ type: "hit", id: h.id })
  }

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.stopPropagation()
        addHit(e.clientX)
      }}
      className="relative h-20 cursor-crosshair select-none rounded border border-border bg-border"
    >
      {secs.map((sec, i) => (
        <div
          key={i}
          className={`absolute top-0 flex h-full flex-col items-center justify-center overflow-hidden border-r border-border ${i % 2 ? "bg-border/40" : "bg-border/20"}`}
          style={{
            left: `${pct(sec.start)}%`,
            width: `${pct(sec.end) - pct(sec.start)}%`,
          }}
        >
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEdit({ type: "removeStage", index: i })}
            className="absolute right-1 top-1 text-muted-foreground/60 hover:text-destructive"
            title="remove stage"
          >
            <X className="size-3" />
          </button>
          <span className="truncate px-1 text-detail font-medium text-foreground">
            {sec.ref.stage}
          </span>
          <span className="font-mono text-detail tabular-nums text-muted-foreground/70">
            {sec.end - sec.start}f
          </span>
        </div>
      ))}

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
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onEdit({ type: "removeRestZone" })}
              className="absolute right-1 top-1 z-20 text-muted-foreground/60 hover:text-destructive"
              title="remove rest zone (last stage expands to the end)"
            >
              <X className="size-3" />
            </button>
          </div>
          <div
            onPointerDown={(e) => {
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (e.buttons)
                onEdit({ type: "moveRestStart", frame: frameAt(e.clientX) })
            }}
            className="absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 cursor-ew-resize items-stretch justify-center"
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
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (e.buttons)
              onEdit({
                type: "moveBoundary",
                index: i,
                frame: frameAt(e.clientX),
              })
          }}
          className="absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 cursor-ew-resize items-stretch justify-center"
          style={{ left: `${pct(b.frame)}%` }}
          title={`boundary @ ${b.frame} (${b.cue})`}
        >
          <div className={`w-0.5 ${CUE_COLOR[b.cue]}`} />
        </div>
      ))}

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
            className={`size-3.5 rounded-full ${exceeding.has(h.id) ? "border-2 border-destructive" : "border border-background"} ${CUE_COLOR[h.cue]} ${selected?.id === h.id ? "ring-2 ring-foreground" : ""}`}
          />
        </div>
      ))}

      <span className="pointer-events-none absolute bottom-0.5 left-1 font-mono text-detail text-muted-foreground/60">
        {clip.start}
      </span>
      <span className="pointer-events-none absolute bottom-0.5 right-1 font-mono text-detail text-muted-foreground/60">
        {clip.end}
      </span>
    </div>
  )
}
