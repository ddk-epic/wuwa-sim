import { X } from "lucide-react"
import { reconcileForte } from "../reconcile"
import type { ForteClip, ForteClipEdit } from "../clip"

/**
 * Equal-width cells, one per occurrence slot: the discrete selector the holder,
 * scrub, and stepper all drive. Each cell carries its stage, a shot indicator,
 * and the measured gain, so the gauge overlay itself stays free of clutter.
 */
export function ForteRuler({
  clip,
  forteCap,
  selected,
  onSelect,
  shotIds,
  onEdit,
}: {
  clip: ForteClip
  forteCap: number
  selected: number
  onSelect: (index: number) => void
  shotIds: Set<string>
  onEdit: (edit: ForteClipEdit) => ForteClip
}) {
  const locked = clip.stagesLocked ?? false
  const reading = reconcileForte(clip, forteCap)
  const gainOf = new Map(
    reading.status === "measured"
      ? reading.observations.map((o) => [o.owner, o.gain])
      : [],
  )

  if (clip.slots.length === 0)
    return (
      <div className="flex h-22 items-center justify-center rounded border border-dashed border-border text-detail text-muted-foreground/60">
        Add stages to build the sequence.
      </div>
    )

  return (
    <div className="flex h-22 select-none overflow-hidden rounded border border-border bg-border">
      {clip.slots.map((slot, i) => {
        const gain = gainOf.get(i)
        const isSel = i === selected
        return (
          <button
            key={slot.id}
            onClick={() => onSelect(i)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 border-r border-border last:border-r-0 ${isSel ? "bg-primary/20" : i % 2 ? "bg-border/40 hover:bg-border/60" : "bg-border/20 hover:bg-border/50"}`}
          >
            {!locked && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit({ type: "removeStage", index: i })
                }}
                className="absolute right-1 top-1 text-muted-foreground/60 hover:text-destructive"
                title="remove occurrence"
              >
                <X className="size-3" />
              </span>
            )}
            <span className="flex max-w-full items-center gap-1 px-1">
              <span
                className={`size-1.5 shrink-0 rounded-full ${shotIds.has(slot.id) ? "bg-sky-400" : "bg-muted-foreground/25"}`}
                title={
                  shotIds.has(slot.id) ? "screenshot loaded" : "no screenshot"
                }
              />
              <span className="truncate text-label font-medium text-foreground">
                {slot.ref.stage}
              </span>
            </span>
            <span className="font-mono text-micro text-muted-foreground/60">
              entry {i + 1}
            </span>
            <span className="font-mono text-detail tabular-nums text-amber-300/90">
              {gain == null ? "" : `+${gain.toFixed(1)}`}
            </span>
          </button>
        )
      })}
    </div>
  )
}
