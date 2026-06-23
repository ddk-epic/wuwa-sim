import { useState } from "react"
import { Check, ChevronDown, ChevronRight, ChevronsDownUp } from "lucide-react"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { CUE_COLOR } from "../shared"
import type { StageGroup } from "../stages"
import {
  animationSplitOf,
  clipDisplayName,
  hitsByStage,
  sections,
  stageTiming,
} from "../types"
import type { Clip, CueTag, StageRef } from "../types"
import { statusOf } from "../reconcile"
import type { Reconciliation, StageStatus } from "../reconcile"

// Color of the corroboration chip — the row's only semantic color. The hit
// counter stays monochrome so the two axes don't clash.
const CHIP: Record<StageStatus["status"], string> = {
  unmeasured: "bg-muted-foreground/40",
  single: "bg-amber-400",
  confirmed: "bg-ui-heal",
  conflict: "bg-destructive",
}

// Read-only campaign checklist over the character's whole stage catalog (grouped
// by skill). The corroboration chip is cross-clip (the reconciler); the hit
// counter is the best occurrence across clips. Open-state is keyed by stage id
// and survives clip switches — collapse-all is the only thing that clears it.
export function StageOverview({
  groups,
  clips,
  recon,
  onJumpToClip,
}: {
  groups: StageGroup[]
  clips: Clip[]
  recon: Reconciliation
  onJumpToClip?: (clipId: string) => void
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pl-3 pr-5.5 pb-2 pt-3">
        <p className="text-micro font-medium uppercase tracking-[1px] text-muted-foreground/70">
          Stages
        </p>
        <button
          onClick={() => setOpen(new Set())}
          className="text-muted-foreground/60 hover:text-foreground"
          title="Collapse all"
        >
          <ChevronsDownUp className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-scroll pl-3 pr-1.5 pb-3">
        {groups.map((g) => (
          <div key={g.skill} className="mb-3">
            <p className="mb-1 flex items-baseline gap-1.5 text-detail font-medium text-muted-foreground">
              <span>{g.skill}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-micro tracking-[1px] text-muted-foreground/60">
                {STAGE_TYPE_LABELS[g.type]}
              </span>
            </p>
            <div className="flex flex-col gap-1">
              {g.stages.map((s) => (
                <StageRow
                  key={s.id}
                  stage={s}
                  status={statusOf(recon, s.id)}
                  clips={clips}
                  open={open.has(s.id)}
                  onToggle={() => toggle(s.id)}
                  onJumpToClip={onJumpToClip}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface HitView {
  id: string
  cue: CueTag
  af: number
}

// The clip with the most hits marked for this stage's first occurrence — the
// honest "best you've captured anywhere" reading, independent of which clip is
// selected. A split stage's hits resolve to 0 (they land in the frozen animation).
function bestHits(
  clips: Clip[],
  stageId: string,
): { clipId: string; hits: HitView[] } | null {
  let best: { clipId: string; hits: HitView[] } | null = null
  for (const clip of clips) {
    const secs = sections(clip)
    const i = secs.findIndex((s) => s.ref.id === stageId)
    if (i === -1) continue
    const split = stageTiming(clip, i, secs).animationFrames > 0
    const hits = hitsByStage(clip)[i].map((h) => ({
      id: h.id,
      cue: h.cue,
      af: split ? 0 : h.frame - secs[i].start,
    }))
    if (!best || hits.length > best.hits.length)
      best = { clipId: clip.id, hits }
  }
  return best
}

// Whether any clip has placed an animation split on this stage's first occurrence.
function hasSplit(clips: Clip[], stageId: string): boolean {
  return clips.some((clip) => {
    const i = sections(clip).findIndex((s) => s.ref.id === stageId)
    return i !== -1 && animationSplitOf(clip, i) != null
  })
}

// One catalog stage's row: a corroboration chip + a monochrome hit counter. The
// drill-down shows the conflicting clips (for `conflict`) or the marked hits.
function StageRow({
  stage,
  status,
  clips,
  open,
  onToggle,
  onJumpToClip,
}: {
  stage: StageRef
  status: StageStatus
  clips: Clip[]
  open: boolean
  onToggle: () => void
  onJumpToClip?: (clipId: string) => void
}) {
  const best = bestHits(clips, stage.id)
  const present = best !== null
  const count = best?.hits.length ?? 0
  const capacity = stage.hitCount

  // A cutscene stage's reading is frozen-animation garbage until split apart, so
  // hold it at unmeasured (grey) and show the split as the work to do.
  const splitDone = hasSplit(clips, stage.id)
  const splitBlocked = stage.expectsSplit === true && !splitDone
  const shown: StageStatus = splitBlocked ? { status: "unmeasured" } : status

  const observations = "observations" in shown ? shown.observations : []
  const isConflict = shown.status === "conflict"

  const canOpen = isConflict ? observations.length > 0 : count > 0
  const isOpen = open && canOpen

  const counterTone =
    capacity > 0 && count === capacity
      ? "text-foreground"
      : "text-muted-foreground/70"

  return (
    <div>
      <button
        disabled={!canOpen}
        onClick={() => canOpen && onToggle()}
        className={`flex w-full items-center justify-between rounded border border-border px-2 py-1 text-left text-detail text-foreground ${canOpen ? "hover:border-muted-foreground/40 hover:bg-card" : "cursor-default"}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {canOpen ? (
            isOpen ? (
              <ChevronDown className="size-3 shrink-0 text-muted-foreground/60" />
            ) : (
              <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
            )
          ) : (
            <span className="size-3 shrink-0" />
          )}
          <span
            className={`size-2 shrink-0 rounded-full ${CHIP[shown.status]}`}
            title={splitBlocked ? "needs animation split" : shown.status}
          />
          <span
            className={`truncate ${present ? "" : "text-muted-foreground"}`}
          >
            {stage.stage}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono tabular-nums">
          {isConflict && shown.status === "conflict" && (
            <span className="text-micro text-muted-foreground/60">
              ±{shown.spread}
            </span>
          )}
          <Counter
            expectsSplit={stage.expectsSplit === true}
            splitDone={splitDone}
            capacity={capacity}
            count={count}
            tone={counterTone}
          />
        </span>
      </button>

      {isOpen && isConflict && (
        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
          {observations.map((o) => (
            <button
              key={o.clipId}
              onClick={() => onJumpToClip?.(o.clipId)}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-left text-detail hover:text-foreground"
            >
              <span className="truncate text-muted-foreground/70">
                {clipDisplayName(clips.find((c) => c.id === o.clipId)!)}
              </span>
              <span className={`size-2 rounded-full ${CUE_COLOR[o.cue]}`} />
              <span className="pr-2 text-right font-mono tabular-nums text-foreground">
                {o.value}
              </span>
            </button>
          ))}
        </div>
      )}

      {isOpen && !isConflict && best && (
        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
          {best.hits.map((h, idx) => (
            <div
              key={h.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-detail"
            >
              <span className="font-mono text-muted-foreground/70">
                hit [{idx + 1}]
              </span>
              <span className={`size-2 rounded-full ${CUE_COLOR[h.cue]}`} />
              <span className="pr-2 text-right font-mono tabular-nums text-foreground">
                {h.af}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// The hit axis, per stage kind: a cutscene shows the split as its work; a
// no-damage stage has nothing to count and passes with a neutral check;
// everything else shows `hits / capacity`.
function Counter({
  expectsSplit,
  splitDone,
  capacity,
  count,
  tone,
}: {
  expectsSplit: boolean
  splitDone: boolean
  capacity: number
  count: number
  tone: string
}) {
  if (expectsSplit)
    return (
      <span
        className={splitDone ? "text-foreground" : "text-muted-foreground/50"}
      >
        split
      </span>
    )
  if (capacity === 0)
    return <Check className="size-3 text-muted-foreground/60" />
  return <span className={tone}>{`${count}/${capacity}`}</span>
}
