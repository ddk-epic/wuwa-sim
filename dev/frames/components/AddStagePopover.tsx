import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import type { StageGroup } from "../stages"
import type { StageRef } from "../types"

// Anchored, stays-open-while-picking catalog. Adding never dismisses it; Esc, the
// X, or an outside click do. Duplicates are intentional — an action string can
// repeat a stage — so a click always appends.
export function AddStagePopover({
  groups,
  onAdd,
}: {
  groups: StageGroup[]
  onAdd: (ref: StageRef) => void
}) {
  const [open, setOpen] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Open centred on the button but clamped into the page (below the 49px header,
  // above the viewport bottom) so a tall catalog never rides off-screen — it
  // scrolls internally instead. Re-place on scroll/resize to stay anchored.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const HEADER = 49
    const GAP = 20
    function place() {
      const btn = buttonRef.current
      const pop = popoverRef.current
      if (!btn || !pop) return
      const b = btn.getBoundingClientRect()
      const h = pop.offsetHeight
      const min = HEADER + GAP
      const max = window.innerHeight - h - GAP
      const centred = b.top + b.height / 2 - h / 2
      setPos({
        top: Math.max(min, Math.min(max, centred)),
        left: b.right + GAP,
      })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open])

  function add(stage: StageRef) {
    onAdd(stage)
    setFlashId(stage.id)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashId(null), 300)
  }

  return (
    <div ref={ref}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-0.5 rounded border border-dashed border-gray-700 pl-2 pr-2.5 py-1 text-sm text-muted-foreground hover:border-muted-foreground hover:text-foreground"
      >
        <Plus className="size-4" /> Stage
      </button>
      {open && (
        <div
          ref={popoverRef}
          style={
            pos ? { top: pos.top, left: pos.left } : { visibility: "hidden" }
          }
          className="fixed z-50 flex max-h-[calc(100vh-81px)] w-64 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between px-2 pb-1 pt-2">
            <span className="text-micro font-medium uppercase tracking-[1px] text-muted-foreground/70">
              Add stage
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground/60 hover:text-foreground"
              title="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {groups.map((g) => (
              <div key={g.skill} className="mb-2">
                <p className="mb-1 text-detail font-medium text-muted-foreground">
                  {g.skill}
                </p>
                <div className="flex flex-col gap-1">
                  {g.stages.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => add(s)}
                      className={`flex items-center justify-between rounded border px-2 py-1 text-left text-detail transition-colors ${flashId === s.id ? "border-foreground/60 bg-foreground/10" : "border-border hover:border-muted-foreground/40 hover:bg-border"}`}
                    >
                      <span className="truncate">{s.stage}</span>
                      <span className="text-muted-foreground/60">
                        {s.hitCount} hit{s.hitCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="h-1.5 shrink-0" />
        </div>
      )}
    </div>
  )
}
