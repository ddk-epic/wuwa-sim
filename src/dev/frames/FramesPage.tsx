import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Plus,
  Trash2,
  Film,
  X,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  Check,
} from "lucide-react"
import { CHARACTERS, findCharacter, stageGroups } from "./stages"
import type { StageGroup } from "./stages"
import { loadClips, saveClips } from "./storage"
import {
  CUES,
  applyClipEdit,
  clipDisplayName,
  exceedingHitIds,
  hitsByStage,
  sections,
} from "./types"
import type { Clip, ClipEdit, CueTag, HitMark, StageRef } from "./types"

const uid = () => Math.random().toString(36).slice(2, 9)

const CUE_COLOR: Record<CueTag, string> = {
  impactFlash: "bg-emerald-500",
  vfxEdge: "bg-sky-500",
  animationBreak: "bg-amber-500",
  estimate: "bg-zinc-500",
}

type Selected = { type: "boundary" | "hit"; id: string } | null

function emptyClip(): Clip {
  return {
    id: uid(),
    name: "",
    start: 0,
    end: 60,
    stageRefs: [],
    boundaries: [],
    hits: [],
  }
}

export function FramesPage() {
  const [characterName, setCharacterName] = useState(CHARACTERS[0]?.name ?? "")
  const [clips, setClips] = useState<Clip[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const char = findCharacter(characterName)
  const groups = useMemo(() => (char ? stageGroups(char) : []), [char])
  const clip = clips.find((c) => c.id === selectedId) ?? null

  // Hydrate the initial character's saved clips after mount — client-only, so SSR
  // (which has no localStorage) and the first client render stay identical.
  useEffect(() => {
    loadInto(characterName)
  }, [])

  function loadInto(name: string) {
    const loaded = loadClips(name)
    setClips(loaded)
    setSelectedId(loaded[0]?.id ?? null)
  }

  // Persisting writer: every clip mutation funnels through here, so storage stays
  // in sync without a save-effect racing the load on character switch.
  function commit(next: Clip[]) {
    setClips(next)
    saveClips(characterName, next)
  }

  function pickCharacter(name: string) {
    setCharacterName(name)
    loadInto(name)
  }

  function addClip() {
    const c = emptyClip()
    commit([...clips, c])
    setSelectedId(c.id)
  }

  function editClip(id: string, edit: ClipEdit): Clip {
    const next = applyClipEdit(clips.find((c) => c.id === id)!, edit)
    commit(clips.map((c) => (c.id === id ? next : c)))
    return next
  }

  function removeClip(id: string) {
    const next = clips.filter((c) => c.id !== id)
    commit(next)
    if (selectedId === id) setSelectedId(next[next.length - 1]?.id ?? null)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Film className="size-5 text-muted-foreground" />
        <h1 className="text-sm font-semibold tracking-wide">Frame Tool</h1>
        <span className="font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
          /dev/frames
        </span>
        <select
          className="ml-auto rounded border border-border bg-card px-2 py-1 text-sm"
          value={characterName}
          onChange={(e) => pickCharacter(e.target.value)}
        >
          {CHARACTERS.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </header>

      <div className="grid grid-cols-[16rem_1fr]">
        <aside className="h-[calc(100vh-49px)] overflow-y-auto border-r border-border p-3">
          <StageOverview groups={groups} clip={clip} />
        </aside>

        <main className="h-[calc(100vh-49px)] overflow-y-auto p-5">
          <h2 className="mb-4 text-title font-bold tracking-tight">
            {characterName}
          </h2>

          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-micro font-medium uppercase tracking-[1px] text-muted-foreground/70">
              Clips
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {clips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`max-w-56 truncate rounded border px-3 py-1 text-sm transition-colors ${c.id === selectedId ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-card hover:text-foreground"}`}
                >
                  {clipDisplayName(c)}
                </button>
              ))}
              <button
                onClick={addClip}
                className="flex items-center gap-1 rounded border border-dashed border-gray-700 px-3 py-1 text-sm text-muted-foreground hover:border-muted-foreground hover:text-foreground"
              >
                <Plus className="size-4" /> Clip
              </button>
            </div>
          </div>

          <hr className="my-6 border-border" />

          {!clip && (
            <p className="text-sm text-muted-foreground">No clip selected.</p>
          )}
          {clip && (
            <ClipEditor
              key={clip.id}
              clip={clip}
              groups={groups}
              onEdit={(edit) => editClip(clip.id, edit)}
              onRemove={() => removeClip(clip.id)}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function ClipEditor({
  clip,
  groups,
  onEdit,
  onRemove,
}: {
  clip: Clip
  groups: StageGroup[]
  onEdit: (edit: ClipEdit) => Clip
  onRemove: () => void
}) {
  const [selected, setSelected] = useState<Selected>(null)

  function addStage(ref: StageRef) {
    onEdit({ type: "addStage", ref, boundaryId: uid() })
  }

  return (
    <div className="space-y-5" onPointerDown={() => setSelected(null)}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-detail text-muted-foreground">
          Name
          <input
            className="mt-1 block w-56 rounded border border-border bg-card px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground/50"
            value={clip.name}
            placeholder={clipDisplayName(clip)}
            onChange={(e) => onEdit({ type: "setName", name: e.target.value })}
          />
        </label>
        <FrameField
          label="Start"
          value={clip.start}
          onChange={(v) => onEdit({ type: "setStart", frame: v })}
        />
        <FrameField
          label="End"
          value={clip.end}
          onChange={(v) => onEdit({ type: "setEnd", frame: v })}
        />
        <AddStagePopover groups={groups} onAdd={addStage} />
        <button
          onClick={onRemove}
          className="ml-auto flex items-center gap-1 rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" /> Delete clip
        </button>
      </div>

      <div className="space-y-1">
        <Ruler
          clip={clip}
          selected={selected}
          setSelected={setSelected}
          onEdit={onEdit}
        />

        <p className="pl-1.25 text-detail text-muted-foreground/60">
          Click the ruler to add a hit (dividers/hits are draggable)
        </p>
      </div>

      <MarksTable
        clip={clip}
        selected={selected}
        setSelected={setSelected}
        onEdit={onEdit}
      />
    </div>
  )
}

const COLS =
  "grid grid-cols-[1fr_7rem_3.5rem_5rem_auto] items-center gap-1 py-1 pl-2 pr-1"

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

function MarksTable({
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
            <div className="overflow-hidden rounded border border-border text-detail">
              <div className={`${COLS} bg-card`}>
                <span className="min-w-20 truncate font-medium text-foreground">
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
                <span className="w-4" />
              </div>
              {hits.length === 0 ? (
                <p className="px-2 py-1 text-muted-foreground/60">no hits</p>
              ) : (
                hits.map((h, idx) => (
                  <div
                    key={h.id}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setSelected({ type: "hit", id: h.id })}
                    className={`${COLS} border-t border-border/60 ${
                      selected?.id === h.id
                        ? "bg-border"
                        : exceeding.has(h.id)
                          ? "bg-destructive/15 hover:bg-destructive/25"
                          : "hover:bg-card"
                    }`}
                  >
                    <span className="min-w-20 font-mono text-muted-foreground/70">
                      hit [{idx + 1}]
                    </span>
                    <CueCell cue={h.cue} onChange={(c) => setHitCue(h.id, c)} />
                    <span className="text-right font-mono tabular-nums text-foreground">
                      {h.frame}
                    </span>
                    <span className="text-right font-mono tabular-nums text-muted-foreground">
                      {h.frame - sec.start}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeHit(h.id)
                      }}
                      className="pl-0.5 text-muted-foreground/60 hover:text-destructive"
                      title="delete hit"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {divider && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() =>
                  setSelected({ type: "boundary", id: divider.id })
                }
                className={`${COLS} overflow-hidden rounded border border-border text-detail text-muted-foreground ${selected?.id === divider.id ? "bg-border" : "hover:bg-card"}`}
              >
                <span className="truncate">
                  {sec.ref.stage} ┃ {secs[i + 1]?.ref.stage}
                </span>
                <CueCell
                  cue={divider.cue}
                  onChange={(c) => setBoundaryCue(divider.id, c)}
                />
                <span className="text-right font-mono tabular-nums">
                  {divider.frame}
                </span>
                <span className="text-right text-muted-foreground/60">—</span>
                <span className="w-4" />
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function Ruler({
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
    const h: HitMark = {
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

// Anchored, stays-open-while-picking catalog. Adding never dismisses it; Esc, the
// X, or an outside click do. Duplicates are intentional — an action string can
// repeat a stage — so a click always appends.
function AddStagePopover({
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
        className="flex items-center gap-1 rounded border border-dashed border-gray-700 px-3 py-1 text-sm text-muted-foreground hover:border-muted-foreground hover:text-foreground"
      >
        <Plus className="size-4" /> Stage
      </button>
      {open && (
        <div
          ref={popoverRef}
          style={
            pos ? { top: pos.top, left: pos.left } : { visibility: "hidden" }
          }
          className="fixed z-30 max-h-[calc(100vh-81px)] w-64 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg"
        >
          <div className="mb-1 flex items-center justify-between">
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
                    className={`flex items-center justify-between rounded border px-2 py-1 text-left text-detail transition-colors ${flashId === s.id ? "border-ui-heal/60 bg-ui-heal/15" : "border-border hover:border-muted-foreground/40 hover:bg-border"}`}
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
      )}
    </div>
  )
}

// Read-only progress mirror over the character's whole stage catalog (grouped by
// skill). Each stage's progress is measured against the selected clip; a stage not
// in the clip reads as untouched. Open-state is keyed by catalog stage id and
// deliberately survives clip switches — collapse-all is the only thing that clears it.
function StageOverview({
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
    <>
      <div className="mb-2 flex items-center justify-between">
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

      {groups.map((g) => (
        <div key={g.skill} className="mb-3">
          <p className="mb-1 text-detail font-medium text-muted-foreground">
            {g.skill}
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
    </>
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
  const hits = occ.flatMap(({ sec, i }) =>
    byStage[i].map((h) => ({ id: h.id, cue: h.cue, af: h.frame - sec.start })),
  )

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

function FrameField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="text-detail text-muted-foreground">
      {label}
      <input
        type="number"
        className="mt-1 block w-18 rounded border border-border bg-card px-2 py-1 text-sm tabular-nums text-foreground"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
