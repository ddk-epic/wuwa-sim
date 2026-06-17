import { useState } from "react"
import { Check, ChevronDown, ChevronRight, ChevronsDownUp } from "lucide-react"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { CUE_COLOR } from "../shared"
import type { StageGroup } from "../stages"
import { hitsByStage, sections, stageTiming } from "../types"
import type { Clip, StageRef } from "../types"

// Read-only progress mirror over the character's whole stage catalog (grouped by
// skill). Each stage's progress is measured against the selected clip; a stage not
// in the clip reads as untouched. Open-state is keyed by catalog stage id and
// deliberately survives clip switches — collapse-all is the only thing that clears it.
export function StageOverview({
  groups,
  clip,
}: {
  groups: StageGroup[]
  clip: Clip | null
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
                  clip={clip}
                  open={open.has(s.id)}
                  onToggle={() => toggle(s.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// One catalog stage's progress row. Aggregates hits across every occurrence of this
// stage in the clip (an action string may repeat a stage), so capacity scales with
// the occurrence count; actionFrame stays relative to each occurrence's start.
function StageRow({
  stage,
  clip,
  open,
  onToggle,
}: {
  stage: StageRef
  clip: Clip | null
  open: boolean
  onToggle: () => void
}) {
  const cl = clip
  const secs = cl ? sections(cl) : []
  const byStage = cl ? hitsByStage(cl) : []
  const occ = secs
    .map((sec, i) => ({ sec, i }))
    .filter(({ sec }) => sec.ref.id === stage.id)
  const hits = occ.flatMap(({ sec, i }) => {
    const split = cl ? stageTiming(cl, i, secs).animationFrames > 0 : false
    return byStage[i].map((h) => ({
      id: h.id,
      cue: h.cue,
      af: split ? 0 : h.frame - sec.start,
    }))
  })

  const count = hits.length
  const capacity = (occ.length || 1) * stage.hitCount
  const canOpen = count > 0
  const isOpen = open && canOpen
  const finished = capacity > 0 && count === capacity

  let tone = "text-muted-foreground/60"
  if (capacity > 0 && count > capacity) tone = "text-destructive"
  else if (finished) tone = "text-ui-heal"
  else if (count > 0) tone = "text-foreground"

  return (
    <div>
      <button
        disabled={!canOpen}
        onClick={() => canOpen && onToggle()}
        className={`flex w-full items-center justify-between rounded border border-border px-2 py-1 text-left text-detail ${canOpen ? "hover:border-muted-foreground/40 hover:bg-card" : "cursor-default"} ${tone}`}
      >
        <span className="flex min-w-0 items-center gap-1">
          {canOpen ? (
            isOpen ? (
              <ChevronDown className="size-3 shrink-0" />
            ) : (
              <ChevronRight className="size-3 shrink-0" />
            )
          ) : (
            <span className="size-3 shrink-0" />
          )}
          <span className="truncate">{stage.stage}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 font-mono">
          {finished && <Check className="size-3 text-ui-heal" />}
          <span>{capacity === 0 ? "—" : `${count}/${capacity}`}</span>
        </span>
      </button>

      {isOpen && (
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
                {h.af}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
