import { Fragment } from "react"
import { ChevronLast, Trash2 } from "lucide-react"
import { CUE_COLOR } from "../shared"
import type { Selected } from "../shared"
import {
  CUES,
  exceedingHitIds,
  hitsByStage,
  resolveVariantTarget,
  sections,
  stageIndexOf,
  stageTiming,
} from "../types"
import type {
  Clip,
  ClipEdit,
  CueTag,
  Section,
  VariantTarget,
  VariantTrack,
} from "../types"

// The trailing column (delete button, or empty) is fixed (not `auto`) so it holds
// the same width on every row — otherwise the 1fr first column absorbs the
// difference and the headers drift between cards. Snap lives in the actionFrame col.
const COLS =
  "grid grid-cols-[1fr_7rem_3.5rem_5rem_1rem] items-center gap-1 py-1 pl-2 pr-1"

function CueCell({
  cue,
  onChange,
}: {
  cue: CueTag
  onChange: (c: CueTag) => void
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 shrink-0 rounded-full ${CUE_COLOR[cue]}`} />
      <select
        value={cue}
        onChange={(e) => onChange(e.target.value as CueTag)}
        className="cursor-pointer bg-transparent text-muted-foreground outline-none"
      >
        {CUES.map((c) => (
          <option key={c.tag} value={c.tag} className="bg-card">
            {c.label}
          </option>
        ))}
      </select>
    </span>
  )
}

function SnapButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="text-muted-foreground/60 hover:text-foreground"
      title="snap to current frame"
    >
      <ChevronLast className="size-3.5" />
    </button>
  )
}

export function MarksTable({
  clip,
  selected,
  setSelected,
  onEdit,
  playhead,
  hasVideo,
}: {
  clip: Clip
  selected: Selected
  setSelected: (s: Selected) => void
  onEdit: (edit: ClipEdit) => Clip
  playhead: number
  hasVideo: boolean
}) {
  if (clip.stageRefs.length === 0) {
    return (
      <p className="text-detail text-muted-foreground/60">
        Add stages to see their marks.
      </p>
    )
  }

  const secs = sections(clip)
  const byStage = hitsByStage(clip)
  const exceeding = exceedingHitIds(clip)
  const setHitCue = (id: string, cue: CueTag) =>
    onEdit({ type: "setHitCue", id, cue })
  const setBoundaryCue = (id: string, cue: CueTag) =>
    onEdit({ type: "setBoundaryCue", id, cue })
  const removeHit = (id: string) => onEdit({ type: "removeHit", id })

  return (
    <div className="w-2/5 space-y-2">
      {secs.map((sec, i) => {
        const last = i === secs.length - 1
        const hits = byStage[i]
        const divider = last ? null : clip.boundaries[i]
        return (
          <Fragment key={i}>
            <div className="min-w-108 overflow-hidden rounded border border-border text-detail">
              <div className={`${COLS} bg-card`}>
                <span className="min-w-28 truncate font-medium text-foreground">
                  Stage {i + 1}
                  <span className="px-1.5 font-normal text-muted-foreground/70">
                    {sec.end - sec.start}f
                  </span>
                  <span
                    className={`font-mono font-normal ${hits.length > sec.ref.hitCount ? "text-destructive" : "text-muted-foreground/70"}`}
                    title="hits / recorded hit count"
                  >
                    {hits.length}/{sec.ref.hitCount}
                  </span>
                </span>
                <span className="text-muted-foreground/70">cue</span>
                <span className="text-right text-muted-foreground/70">
                  frame
                </span>
                <span className="text-right text-muted-foreground/70">
                  actionFrame
                </span>
                <span className="w-2" />
              </div>
              <VariantRow
                clip={clip}
                stageIndex={i}
                hitCount={hits.length}
                onEdit={onEdit}
              />
              <SplitRow
                clip={clip}
                stageIndex={i}
                sec={sec}
                selected={selected}
                setSelected={setSelected}
                onEdit={onEdit}
                playhead={playhead}
                hasVideo={hasVideo}
              />
              {hits.length === 0 ? (
                <p className="px-2 py-1 text-muted-foreground/60">no hits</p>
              ) : (
                hits.map((h, idx) => {
                  const posIdx = stageIndexOf(clip, h.frame)
                  // Displaced = the frame sits in a different real stage than its
                  // owner. In the rest zone (posIdx === -1) there's no stage, so no badge.
                  const displaced = posIdx !== -1 && posIdx !== i
                  return (
                    <div
                      key={h.id}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setSelected({ type: "hit", id: h.id })}
                      className={`${COLS} border-t border-border/60 ${
                        selected?.type === "hit" && selected.id === h.id
                          ? "bg-border"
                          : exceeding.has(h.id)
                            ? "bg-destructive/15 hover:bg-destructive/25"
                            : "hover:bg-card"
                      }`}
                    >
                      <span className="flex min-w-28 items-center gap-1.5 font-mono text-muted-foreground/70">
                        hit [{idx + 1}]
                        {displaced && (
                          <span
                            className="rounded bg-amber-500/15 px-1 text-micro text-amber-500"
                            title={`delayed — frame lands in stage ${posIdx + 1}`}
                          >
                            ⤶ S{posIdx + 1}
                          </span>
                        )}
                      </span>
                      <CueCell
                        cue={h.cue}
                        onChange={(c) => setHitCue(h.id, c)}
                      />
                      <span className="text-right font-mono tabular-nums text-foreground">
                        {h.frame}
                      </span>
                      <span className="flex items-center justify-end gap-1.5 font-mono tabular-nums text-muted-foreground">
                        {h.frame - sec.start}
                        {hasVideo && (
                          <SnapButton
                            onClick={() =>
                              onEdit({
                                type: "moveHit",
                                id: h.id,
                                frame: playhead,
                              })
                            }
                          />
                        )}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeHit(h.id)
                        }}
                        className="text-muted-foreground/60 hover:text-destructive"
                        title="delete hit"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {divider && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() =>
                  setSelected({ type: "boundary", id: divider.id })
                }
                className={`${COLS} min-w-108 overflow-hidden rounded border border-border text-detail text-muted-foreground ${selected?.type === "boundary" && selected.id === divider.id ? "bg-border" : "hover:bg-card"}`}
              >
                <span className="min-w-28 truncate">
                  {sec.ref.stage} ┃ {secs[i + 1]?.ref.stage}
                </span>
                <CueCell
                  cue={divider.cue}
                  onChange={(c) => setBoundaryCue(divider.id, c)}
                />
                <span className="text-right font-mono tabular-nums">
                  {divider.frame}
                </span>
                <span className="flex items-center justify-end gap-1.5 text-muted-foreground/60">
                  —
                  {hasVideo && (
                    <SnapButton
                      onClick={() =>
                        onEdit({
                          type: "moveBoundary",
                          index: i,
                          frame: playhead,
                        })
                      }
                    />
                  )}
                </span>
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function targetToValue(t: VariantTarget | undefined): string {
  if (!t) return "none"
  return t.kind === "hit" ? `hit:${t.n}` : t.kind
}

function valueToTarget(v: string): VariantTarget | null {
  if (v === "start" || v === "last") return { kind: v }
  const m = /^hit:(\d+)$/.exec(v)
  return m ? { kind: "hit", n: Number(m[1]) } : null
}

function optionLabel(v: string, track: VariantTrack): string {
  if (v === "none") return "none"
  if (v === "start") return track === "cancel" ? "start (instant)" : "start (0)"
  if (v === "last") return "last hit"
  return `hit ${v.slice(4)}`
}

// The variant kind a resolved pin produces: swap always swaps; cancel pinned
// to start becomes instantCancel, otherwise cancel.
function resolvedKind(track: VariantTrack, target: VariantTarget): string {
  if (track === "swap") return "swap"
  return target.kind === "start" ? "instant" : "cancel"
}

// Variant authoring lives here because the stage-overview sidebar is read-only.
// The granularity is per clip-occurrence; cross-clip reconciliation is the solver's.
function VariantRow({
  clip,
  stageIndex,
  hitCount,
  onEdit,
}: {
  clip: Clip
  stageIndex: number
  hitCount: number
  onEdit: (edit: ClipEdit) => Clip
}) {
  return (
    <div className="flex items-center gap-4 border-t border-border/60 bg-card/40 px-2 py-1 text-detail">
      <span className="text-micro uppercase tracking-[1px] text-muted-foreground/50">
        variants
      </span>
      <VariantPicker
        track="cancel"
        clip={clip}
        stageIndex={stageIndex}
        hitCount={hitCount}
        onEdit={onEdit}
      />
      <VariantPicker
        track="swap"
        clip={clip}
        stageIndex={stageIndex}
        hitCount={hitCount}
        onEdit={onEdit}
      />
    </div>
  )
}

function SplitRow({
  clip,
  stageIndex,
  sec,
  selected,
  setSelected,
  onEdit,
  playhead,
  hasVideo,
}: {
  clip: Clip
  stageIndex: number
  sec: Section
  selected: Selected
  setSelected: (s: Selected) => void
  onEdit: (edit: ClipEdit) => Clip
  playhead: number
  hasVideo: boolean
}) {
  const split = clip.animationSplits?.[stageIndex] ?? null
  if (!split) {
    return (
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() =>
          onEdit({
            type: "setAnimationSplit",
            stageIndex,
            frame: Math.round((sec.start + sec.end) / 2),
            cue: "vfxEdge",
          })
        }
        className="block w-full border-t border-border/60 bg-card/40 px-2 py-1 text-left text-micro uppercase tracking-[1px] text-muted-foreground/40 hover:text-muted-foreground"
      >
        + animation split
      </button>
    )
  }
  const { animationFrames } = stageTiming(clip, stageIndex)
  const isSel = selected?.type === "split" && selected.index === stageIndex
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => setSelected({ type: "split", index: stageIndex })}
      className={`${COLS} border-t border-border/60 ${isSel ? "bg-border" : "bg-card/40 hover:bg-card"}`}
    >
      <span className="min-w-28 truncate text-muted-foreground">
        animation <span className="text-muted-foreground/40">│ lock</span>
      </span>
      <CueCell
        cue={split.cue}
        onChange={(c) =>
          onEdit({ type: "setAnimationSplitCue", stageIndex, cue: c })
        }
      />
      <span className="text-right font-mono tabular-nums text-foreground">
        {split.frame}
      </span>
      <span
        className="flex items-center justify-end gap-1.5 font-mono tabular-nums text-muted-foreground"
        title="animationFrames"
      >
        {animationFrames}f
        {hasVideo && (
          <SnapButton
            onClick={() =>
              onEdit({
                type: "moveAnimationSplit",
                stageIndex,
                frame: playhead,
              })
            }
          />
        )}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onEdit({ type: "clearAnimationSplit", stageIndex })
        }}
        className="text-muted-foreground/60 hover:text-destructive"
        title="remove animation split"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

function VariantPicker({
  track,
  clip,
  stageIndex,
  hitCount,
  onEdit,
}: {
  track: VariantTrack
  clip: Clip
  stageIndex: number
  hitCount: number
  onEdit: (edit: ClipEdit) => Clip
}) {
  const target = clip.variants?.[stageIndex]?.[track]
  const resolved = target
    ? resolveVariantTarget(clip, stageIndex, target)
    : null
  const hitOpts = Array.from({ length: hitCount }, (_, k) => `hit:${k + 1}`)
  // cancel leads with `last` (its default); swap leads with `start` (its default).
  const options =
    track === "cancel"
      ? ["none", "last", ...hitOpts, "start"]
      : ["none", "start", "last", ...hitOpts]

  function onChange(raw: string) {
    const next = valueToTarget(raw)
    if (!next) onEdit({ type: "clearVariant", stageIndex, track })
    else onEdit({ type: "setVariant", stageIndex, track, target: next })
  }

  return (
    <span className="flex items-center gap-1 text-muted-foreground/70">
      <span className="font-mono">{track}</span>
      <select
        value={targetToValue(target)}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="cursor-pointer rounded border border-border bg-transparent px-1 text-foreground outline-none"
      >
        {options.map((v) => (
          <option key={v} value={v} className="bg-card">
            {optionLabel(v, track)}
          </option>
        ))}
      </select>
      {target &&
        (resolved?.ok ? (
          <span className="font-mono tabular-nums text-muted-foreground">
            → {resolvedKind(track, target)} {resolved.actionTime}f
          </span>
        ) : (
          <span className="text-amber-500" title={resolved?.reason}>
            unresolved
          </span>
        ))}
    </span>
  )
}
