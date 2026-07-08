import { Fragment, useEffect, useState } from "react"
import { ChevronLast, Trash2 } from "lucide-react"
import { fillFractionAt } from "../calibration"
import { forteSections, forteStageIndexOf } from "../clip"
import type { ForteClip, ForteClipEdit, ForteSeparator } from "../clip"
import { reconcileForte } from "../reconcile"

const COLS =
  "grid grid-cols-[1fr_4rem_4rem_5rem_1rem] items-center gap-1 px-2 py-1"

export function SeparatorTable({
  clip,
  forteCap,
  onEdit,
  playhead,
  hasVideo,
}: {
  clip: ForteClip
  forteCap: number
  onEdit: (edit: ForteClipEdit) => ForteClip
  playhead: number
  hasVideo: boolean
}) {
  const secs = forteSections(clip)
  const reading = reconcileForte(clip, forteCap)
  const gainOf = new Map(
    reading.status === "measured"
      ? reading.observations.map((o) => [o.sepId, o.gain])
      : [],
  )
  const byOwner = (owner: number) =>
    (clip.separators ?? [])
      .filter((s) => s.owner === owner)
      .sort((a, b) => a.frame - b.frame)

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-micro font-medium uppercase tracking-[1px] text-muted-foreground/70">
          forte(seq)
        </span>
        {reading.status === "measured" ? (
          <span className="font-mono text-sm tabular-nums text-foreground">
            {reading.mean.toFixed(1)}
            <span className="text-muted-foreground/70">
              {" "}
              ± {reading.spread.toFixed(1)}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/60">unmeasured</span>
        )}
      </div>

      <BaselineRow clip={clip} onEdit={onEdit} />

      {secs.map((sec, i) => {
        const seps = byOwner(i)
        return (
          <Fragment key={i}>
            <div className="overflow-hidden rounded border border-border text-detail">
              <div className={`${COLS} bg-card`}>
                <span className="truncate font-medium text-foreground">
                  {sec.ref.stage}
                  <span className="px-1.5 font-normal text-muted-foreground/70">
                    {sec.end - sec.start}f
                  </span>
                </span>
                <span className="text-right text-muted-foreground/70">
                  frame
                </span>
                <span className="text-right text-muted-foreground/70">
                  fill
                </span>
                <span className="text-right text-muted-foreground/70">
                  gain
                </span>
                <span className="w-2" />
              </div>
              {seps.length === 0 ? (
                <p className="px-2 py-1 text-muted-foreground/60">
                  no separator
                </p>
              ) : (
                seps.map((s) => (
                  <SeparatorRow
                    key={s.id}
                    clip={clip}
                    sep={s}
                    owner={i}
                    gain={gainOf.get(s.id)}
                    onEdit={onEdit}
                    playhead={playhead}
                    hasVideo={hasVideo}
                  />
                ))
              )}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

function SeparatorRow({
  clip,
  sep,
  owner,
  gain,
  onEdit,
  playhead,
  hasVideo,
}: {
  clip: ForteClip
  sep: ForteSeparator
  owner: number
  gain: number | undefined
  onEdit: (edit: ForteClipEdit) => ForteClip
  playhead: number
  hasVideo: boolean
}) {
  const posIdx = forteStageIndexOf(clip, sep.frame)
  const displaced = posIdx !== owner
  const secs = forteSections(clip)
  const landing = posIdx === -1 ? "off clip" : secs[posIdx].ref.stage
  const fraction = clip.calibration
    ? fillFractionAt(clip.calibration, sep.fill)
    : 0

  return (
    <div className={`${COLS} border-t border-border/60 hover:bg-card`}>
      <span className="flex items-center gap-1.5 font-mono text-muted-foreground/70">
        repeat {owner + 1}
        {displaced && (
          <span
            className="max-w-24 truncate rounded bg-amber-500/15 px-1 text-micro text-amber-500"
            title={`frame lands in ${landing}`}
          >
            ⤶ {landing}
          </span>
        )}
      </span>
      <span className="flex items-center justify-end gap-1.5 font-mono tabular-nums text-foreground">
        <FrameInput
          value={sep.frame}
          onChange={(frame) =>
            onEdit({ type: "moveSeparator", id: sep.id, frame })
          }
        />
        {hasVideo && (
          <button
            onClick={() =>
              onEdit({ type: "moveSeparator", id: sep.id, frame: playhead })
            }
            className="text-muted-foreground/60 hover:text-foreground"
            title="snap to current frame"
          >
            <ChevronLast className="size-3.5" />
          </button>
        )}
      </span>
      <span className="text-right font-mono tabular-nums text-muted-foreground">
        {(fraction * 100).toFixed(1)}%
      </span>
      <span className="text-right font-mono tabular-nums text-foreground">
        {gain == null ? "—" : gain.toFixed(1)}
      </span>
      <button
        onClick={() => onEdit({ type: "removeSeparator", id: sep.id })}
        className="text-muted-foreground/60 hover:text-destructive"
        title="delete separator"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

// Commits on blur/Enter so a mid-edit value isn't clamped per keystroke.
function FrameInput({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [value, editing])

  function commit() {
    setEditing(false)
    const n = Number(draft)
    if (draft.trim() === "" || !Number.isFinite(n)) setDraft(String(value))
    else onChange(n)
  }

  return (
    <input
      type="number"
      className="w-12 rounded border border-transparent bg-transparent text-right tabular-nums hover:border-border focus:border-border focus:outline-none"
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
    />
  )
}

function BaselineRow({
  clip,
  onEdit,
}: {
  clip: ForteClip
  onEdit: (edit: ForteClipEdit) => ForteClip
}) {
  const pct = Math.round((clip.baseline ?? 0) * 100)
  return (
    <label className="flex items-center gap-2 text-detail text-muted-foreground">
      baseline
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) =>
          onEdit({
            type: "setBaseline",
            fraction: Number(e.target.value) / 100,
          })
        }
        className="w-40"
      />
      <span className="font-mono tabular-nums">{pct}%</span>
    </label>
  )
}
