import { useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  TriangleAlert,
} from "lucide-react"
import { coverageOf } from "../planner"
import type { Precondition, SuggestedClip } from "../planner"
import type { Clip } from "../types"

const PRECONDITION_LABEL: Record<Precondition, string> = {
  "swap-in": "swap-in",
  "full-energy": "full energy",
  cutscene: "cutscene",
  airborne: "airborne",
  "verify-forte": "verify forte",
  "requires-prior": "needs prior",
}

// The suggested covering set of clips to record, computed from static character
// data. Lives as an accordion inside the clips pool: each row seeds a real Clip
// pre-loaded with its stage sequence, with coverage measured live against the
// clips that already exist.
export function PlannerPanel({
  suggestions,
  clips,
  onSeed,
}: {
  suggestions: SuggestedClip[]
  clips: Clip[]
  onSeed: (s: SuggestedClip) => void
}) {
  const [open, setOpen] = useState(false)
  if (suggestions.length === 0) return null

  return (
    <div className="mb-3 border-b border-border pb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-micro font-medium uppercase tracking-[1px] text-muted-foreground/70 hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        Suggested clips
        <span className="text-muted-foreground/40">{suggestions.length}</span>
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {suggestions.map((s) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              coverage={coverageOf(s, clips)}
              onSeed={() => onSeed(s)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SuggestionRow({
  suggestion,
  coverage,
  onSeed,
}: {
  suggestion: SuggestedClip
  coverage: ReturnType<typeof coverageOf>
  onSeed: () => void
}) {
  const [seeded, setSeeded] = useState(false)
  const gap = suggestion.stages.some((s) => s.footingGap)

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded border border-border p-2 ${
        coverage === "covered" ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-detail leading-snug">
          {suggestion.stages.map((s, i) => (
            <span key={s.ref.id}>
              {i > 0 && (
                <span
                  className={
                    s.verify ? "text-amber-500" : "text-muted-foreground/60"
                  }
                  title={
                    s.verify ? "unproven transition — verify it records" : ""
                  }
                >
                  {" › "}
                </span>
              )}
              <span className="text-foreground">{s.label}</span>
            </span>
          ))}
          <span className="text-muted-foreground/60">{" › "}</span>
          <span
            className="text-muted-foreground/80"
            title="scoped-out basic sentinel — reveals the last stage's end"
          >
            {suggestion.sentinel}
          </span>
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          {suggestion.preconditions.map((p) => (
            <span
              key={p}
              className="rounded bg-background px-1.5 py-0.5 text-micro text-muted-foreground"
            >
              {PRECONDITION_LABEL[p]}
            </span>
          ))}
          {gap && (
            <span
              className="flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-micro text-amber-500"
              title="aerial by name but no footing in the character file"
            >
              <TriangleAlert className="size-3" /> footing gap
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          onSeed()
          setSeeded(true)
          setTimeout(() => setSeeded(false), 1200)
        }}
        title="Create a clip pre-loaded with these stages"
        className="flex shrink-0 items-center rounded border border-dashed border-gray-700 px-1.5 py-1 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
      >
        {seeded ? (
          <Check className="size-3.5 text-ui-heal" />
        ) : (
          <Plus className="size-3.5" />
        )}
      </button>
    </div>
  )
}
