import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, ChevronsDownUp } from "lucide-react"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { CUE_COLOR } from "../shared"
import type { StageGroup } from "../stages"
import { clipDisplayName } from "../clip"
import type { Clip } from "../clip"
import type { StageRef } from "../stage-ref"
import { projectStages, projectionOf } from "../projection"
import type { StageProjection } from "../projection"
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
  const projections = useMemo(() => projectStages(clips, recon), [clips, recon])

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
                  projection={projectionOf(projections, s.id)}
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

// One catalog stage's row: a corroboration chip + a monochrome hit counter. The
// drill-down shows the conflicting clips (for `conflict`) or the marked hits.
function StageRow({
  stage,
  projection,
  clips,
  open,
  onToggle,
  onJumpToClip,
}: {
  stage: StageRef
  projection: StageProjection
  clips: Clip[]
  open: boolean
  onToggle: () => void
  onJumpToClip?: (clipId: string) => void
}) {
  const { status, hits } = projection
  const present = projection.best !== null
  const count = hits.length
  const capacity = stage.hitCount

  // A cutscene stage's reading is frozen-animation garbage until split apart, so
  // hold it at unmeasured (grey) and show the split as the work to do.
  const splitDone = projection.animationFrames !== null
  const splitBlocked = stage.expectsSplit === true && !splitDone
  const shown: StageStatus = splitBlocked ? { status: "unmeasured" } : status

  // A no-damage, non-cutscene stage has nothing to measure or mark — it passes
  // from the start. No actionTime axis, so it carries no corroboration chip.
  const passes = capacity === 0 && stage.expectsSplit !== true

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
          {passes ? (
            <span className="size-2 shrink-0" />
          ) : (
            <span
              className={`size-2 shrink-0 rounded-full ${CHIP[shown.status]}`}
              title={splitBlocked ? "needs animation split" : shown.status}
            />
          )}
          <span
            className={`truncate ${passes ? "font-medium" : present ? "" : "text-muted-foreground"}`}
          >
            {stage.stage}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono tabular-nums">
          {isConflict && (
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

      {isOpen && !isConflict && present && (
        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
          {hits.map((h, idx) => (
            <div
              key={h.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-detail"
            >
              <span className="font-mono text-muted-foreground/70">
                hit [{idx + 1}]
              </span>
              <span className={`size-2 rounded-full ${CUE_COLOR[h.cue]}`} />
              <span className="pr-2 text-right font-mono tabular-nums text-foreground">
                {h.actionFrame}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// The hit axis, per stage kind: a cutscene shows `split` as its work; a no-damage
// stage has nothing to count and reads `pass` from the start; everything else
// shows `hits / capacity`.
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
  if (capacity === 0) return <span className="text-foreground">pass</span>
  return <span className={tone}>{`${count}/${capacity}`}</span>
}
