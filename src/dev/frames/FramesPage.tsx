import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { Plus, Trash2, Film, X } from "lucide-react"
import { CHARACTERS, findCharacter, stageGroups } from "./stages"
import { loadClips, saveClips } from "./storage"
import { CUES, clipDisplayName, sections } from "./types"
import type { Clip, CueTag, HitMark, StageRef } from "./types"

const uid = () => Math.random().toString(36).slice(2, 9)

const CUE_COLOR: Record<CueTag, string> = {
  impactFlash: "bg-emerald-500",
  vfxEdge: "bg-sky-500",
  animationBreak: "bg-amber-500",
  estimate: "bg-zinc-500",
}

type Selected = { type: "boundary" | "hit"; id: string } | null
type Mode = "boundary" | "hit"

function ModeToggle({
  mode,
  setMode,
}: {
  mode: Mode
  setMode: (m: Mode) => void
}) {
  const opts: { value: Mode; label: string }[] = [
    { value: "boundary", label: "Boundaries" },
    { value: "hit", label: "Hits" },
  ]
  return (
    <div
      className="flex h-7 overflow-hidden rounded-sm border border-zinc-700 text-sm"
      role="group"
    >
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => setMode(o.value)}
          aria-pressed={mode === o.value}
          className={`px-3 transition-colors ${mode === o.value ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-400 hover:text-zinc-100"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

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

  function patchClip(id: string, patch: Partial<Clip>) {
    commit(clips.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function removeClip(id: string) {
    commit(clips.filter((c) => c.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function addStage(target: Clip, ref: StageRef) {
    const stageRefs = [...target.stageRefs, ref]
    let boundaries = target.boundaries
    if (target.stageRefs.length >= 1) {
      const prev = target.boundaries.length
        ? target.boundaries[target.boundaries.length - 1].frame
        : target.start
      const frame = Math.round((prev + target.end) / 2)
      boundaries = [
        ...target.boundaries,
        { id: uid(), frame, cue: "animationBreak" },
      ]
    }
    patchClip(target.id, { stageRefs, boundaries })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-5 py-3">
        <Film className="size-5 text-zinc-400" />
        <h1 className="text-sm font-semibold tracking-wide">Frame Tool</h1>
        <span className="text-xs text-zinc-500">
          /dev/frames — step 1: clips &amp; marking
        </span>
        <select
          className="ml-auto rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
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
        <aside className="h-[calc(100vh-49px)] overflow-y-auto border-r border-zinc-800 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Stages
          </p>
          {!clip && (
            <p className="text-xs text-zinc-600">
              Add a clip to build its sequence.
            </p>
          )}
          {clip &&
            groups.map((g) => (
              <div key={g.skill} className="mb-3">
                <p className="mb-1 text-xs font-medium text-zinc-400">
                  {g.skill}
                </p>
                <div className="flex flex-col gap-1">
                  {g.stages.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => addStage(clip, s)}
                      className="flex items-center justify-between rounded border border-zinc-800 px-2 py-1 text-left text-xs hover:border-zinc-600 hover:bg-zinc-900"
                    >
                      <span>{s.stage}</span>
                      <span className="text-zinc-600">
                        {s.hitCount} hit{s.hitCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </aside>

        <main className="h-[calc(100vh-49px)] overflow-y-auto p-5">
          <h2 className="mb-4 text-2xl font-bold tracking-tight">
            {characterName}
          </h2>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            {clips.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`max-w-56 truncate rounded px-3 py-1 text-sm ${c.id === selectedId ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
              >
                {clipDisplayName(c)}
              </button>
            ))}
            <button
              onClick={addClip}
              className="flex items-center gap-1 rounded border border-dashed border-zinc-700 px-3 py-1 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            >
              <Plus className="size-4" /> Clip
            </button>
          </div>

          {!clip && <p className="text-sm text-zinc-500">No clip selected.</p>}
          {clip && (
            <ClipEditor
              key={clip.id}
              clip={clip}
              onPatch={(patch) => patchClip(clip.id, patch)}
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
  onPatch,
  onRemove,
}: {
  clip: Clip
  onPatch: (patch: Partial<Clip>) => void
  onRemove: () => void
}) {
  const [selected, setSelected] = useState<Selected>(null)
  const [mode, setMode] = useState<Mode>("boundary")

  function removeStage(i: number) {
    const stageRefs = clip.stageRefs.filter((_, idx) => idx !== i)
    let boundaries = clip.boundaries
    if (clip.boundaries.length > 0) {
      const bi = i >= clip.boundaries.length ? clip.boundaries.length - 1 : i
      boundaries = clip.boundaries.filter((_, idx) => idx !== bi)
    }
    onPatch({ stageRefs, boundaries })
  }

  return (
    <div className="space-y-5" onPointerDown={() => setSelected(null)}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-zinc-400">
          Name
          <input
            className="mt-1 block w-56 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-600"
            value={clip.name}
            placeholder={clipDisplayName(clip)}
            onChange={(e) => onPatch({ name: e.target.value })}
          />
        </label>
        <FrameField
          label="Start"
          value={clip.start}
          onChange={(v) => onPatch({ start: v })}
        />
        <FrameField
          label="End"
          value={clip.end}
          onChange={(v) => onPatch({ end: v })}
        />
        <span className="pb-1 text-xs text-zinc-500">
          length {clip.end - clip.start}f
        </span>
        <button
          onClick={onRemove}
          className="ml-auto flex items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:border-red-900 hover:text-red-400"
        >
          <Trash2 className="size-3.5" /> Delete clip
        </button>
      </div>

      <div className="flex items-center gap-3">
        <ModeToggle mode={mode} setMode={setMode} />
        <p className="text-xs text-zinc-600">
          {mode === "boundary"
            ? "Drag a divider to resize the adjacent stages · click empty space to deselect"
            : "Click the ruler to drop a hit · drag a hit to move it"}
        </p>
      </div>

      <Ruler
        clip={clip}
        mode={mode}
        selected={selected}
        setSelected={setSelected}
        onPatch={onPatch}
        onRemoveStage={removeStage}
      />

      <p className="text-xs text-zinc-600">
        Click a stage on the left to extend the sequence.
      </p>

      <MarksTable
        clip={clip}
        selected={selected}
        setSelected={setSelected}
        onPatch={onPatch}
      />
    </div>
  )
}

const COLS =
  "grid grid-cols-[1fr_7rem_3.5rem_5rem_1.25rem] items-center gap-1 px-2 py-1"

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
        className="cursor-pointer bg-transparent text-zinc-300 outline-none"
      >
        {CUES.map((c) => (
          <option key={c.tag} value={c.tag} className="bg-zinc-900">
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
  onPatch,
}: {
  clip: Clip
  selected: Selected
  setSelected: (s: Selected) => void
  onPatch: (patch: Partial<Clip>) => void
}) {
  if (clip.stageRefs.length === 0) {
    return (
      <p className="text-xs text-zinc-600">Add stages to see their marks.</p>
    )
  }

  const secs = sections(clip)
  const setHitCue = (id: string, cue: CueTag) =>
    onPatch({ hits: clip.hits.map((h) => (h.id === id ? { ...h, cue } : h)) })
  const setBoundaryCue = (id: string, cue: CueTag) =>
    onPatch({
      boundaries: clip.boundaries.map((b) => (b.id === id ? { ...b, cue } : b)),
    })
  const removeHit = (id: string) =>
    onPatch({ hits: clip.hits.filter((h) => h.id !== id) })

  return (
    <div className="w-2/5 space-y-2">
      {secs.map((sec, i) => {
        const last = i === secs.length - 1
        const hits = clip.hits
          .filter(
            (h) =>
              h.frame >= sec.start &&
              (last ? h.frame <= sec.end : h.frame < sec.end),
          )
          .sort((a, b) => a.frame - b.frame)
        const divider = last ? null : clip.boundaries[i]
        return (
          <Fragment key={i}>
            <div className="overflow-hidden rounded border border-zinc-800 text-xs">
              <div className={`${COLS} bg-zinc-900`}>
                <span className="truncate font-medium text-zinc-200">
                  Stage {i + 1} · {sec.ref.stage}
                  <span className="font-normal text-zinc-500">
                    {" "}
                    · {sec.end - sec.start}f
                  </span>
                </span>
                <span className="text-zinc-500">cue</span>
                <span className="text-right text-zinc-500">frame</span>
                <span className="text-right text-zinc-500">actionFrame</span>
                <span />
              </div>
              {hits.length === 0 ? (
                <p className="px-2 py-1 text-zinc-600">no hits</p>
              ) : (
                hits.map((h) => (
                  <div
                    key={h.id}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setSelected({ type: "hit", id: h.id })}
                    className={`${COLS} border-t border-zinc-900 ${selected?.id === h.id ? "bg-zinc-800/60" : "hover:bg-zinc-900"}`}
                  >
                    <span />
                    <CueCell cue={h.cue} onChange={(c) => setHitCue(h.id, c)} />
                    <span className="text-right tabular-nums text-zinc-300">
                      {h.frame}
                    </span>
                    <span className="text-right tabular-nums text-zinc-400">
                      {h.frame - sec.start}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeHit(h.id)
                      }}
                      className="text-zinc-600 hover:text-red-400"
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
                className={`${COLS} overflow-hidden rounded border border-zinc-800 text-xs text-zinc-400 ${selected?.id === divider.id ? "bg-zinc-800/60" : "hover:bg-zinc-900"}`}
              >
                <span className="truncate">
                  {sec.ref.stage} ┃ {secs[i + 1]?.ref.stage}
                </span>
                <CueCell
                  cue={divider.cue}
                  onChange={(c) => setBoundaryCue(divider.id, c)}
                />
                <span className="text-right tabular-nums">{divider.frame}</span>
                <span className="text-right text-zinc-600">—</span>
                <span />
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
  mode,
  selected,
  setSelected,
  onPatch,
  onRemoveStage,
}: {
  clip: Clip
  mode: Mode
  selected: Selected
  setSelected: (s: Selected) => void
  onPatch: (patch: Partial<Clip>) => void
  onRemoveStage: (i: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const span = Math.max(1, clip.end - clip.start)
  const pct = (f: number) => ((f - clip.start) / span) * 100
  const secs = sections(clip)

  function frameAt(clientX: number) {
    const rect = ref.current!.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.round(clip.start + ratio * span)
  }

  function moveBoundary(i: number, clientX: number) {
    const min = (i > 0 ? clip.boundaries[i - 1].frame : clip.start) + 1
    const max =
      (i < clip.boundaries.length - 1
        ? clip.boundaries[i + 1].frame
        : clip.end) - 1
    if (max < min) return
    const frame = Math.min(max, Math.max(min, frameAt(clientX)))
    onPatch({
      boundaries: clip.boundaries.map((b, idx) =>
        idx === i ? { ...b, frame } : b,
      ),
    })
  }

  function moveHit(id: string, clientX: number) {
    const frame = Math.min(clip.end, Math.max(clip.start, frameAt(clientX)))
    onPatch({ hits: clip.hits.map((h) => (h.id === id ? { ...h, frame } : h)) })
  }

  function addHit(clientX: number) {
    const frame = Math.min(clip.end, Math.max(clip.start, frameAt(clientX)))
    const h: HitMark = { id: uid(), frame, cue: "impactFlash" }
    onPatch({ hits: [...clip.hits, h] })
    setSelected({ type: "hit", id: h.id })
  }

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (mode === "hit") addHit(e.clientX)
        else setSelected(null)
      }}
      className={`relative h-20 select-none rounded border border-zinc-800 bg-zinc-900 ${mode === "hit" ? "cursor-crosshair" : ""}`}
    >
      {secs.map((sec, i) => (
        <div
          key={i}
          className={`absolute top-0 flex h-full flex-col items-center justify-center overflow-hidden border-r border-zinc-700/50 ${i % 2 ? "bg-zinc-800/30" : "bg-zinc-800/10"}`}
          style={{
            left: `${pct(sec.start)}%`,
            width: `${pct(sec.end) - pct(sec.start)}%`,
          }}
        >
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemoveStage(i)}
            className="absolute right-1 top-1 text-zinc-600 hover:text-red-400"
            title="remove stage"
          >
            <X className="size-3" />
          </button>
          <span className="truncate px-1 text-xs font-medium text-zinc-200">
            {sec.ref.stage}
          </span>
          <span className="text-[10px] tabular-nums text-zinc-500">
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
            if (mode === "boundary")
              e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (mode === "boundary" && e.buttons) moveBoundary(i, e.clientX)
          }}
          className={`absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 items-stretch justify-center ${mode === "boundary" ? "cursor-ew-resize" : "cursor-pointer"}`}
          style={{ left: `${pct(b.frame)}%` }}
          title={`boundary @ ${b.frame} (${b.cue})`}
        >
          <div
            className={`w-0.5 ${CUE_COLOR[b.cue]} ${selected?.id === b.id ? "ring-2 ring-white" : ""}`}
          />
        </div>
      ))}

      {clip.hits.map((h) => (
        <div
          key={h.id}
          onPointerDown={(e) => {
            e.stopPropagation()
            setSelected({ type: "hit", id: h.id })
            if (mode === "hit") e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (mode === "hit" && e.buttons) moveHit(h.id, e.clientX)
          }}
          className={`absolute bottom-2 z-20 -translate-x-1/2 ${mode === "hit" ? "cursor-grab" : "cursor-pointer"}`}
          style={{ left: `${pct(h.frame)}%` }}
          title={`hit @ ${h.frame} (${h.cue})`}
        >
          <div
            className={`size-3.5 rounded-full border border-zinc-950 ${CUE_COLOR[h.cue]} ${selected?.id === h.id ? "ring-2 ring-white" : ""}`}
          />
        </div>
      ))}

      <span className="pointer-events-none absolute bottom-0.5 left-1 text-[10px] text-zinc-600">
        {clip.start}
      </span>
      <span className="pointer-events-none absolute bottom-0.5 right-1 text-[10px] text-zinc-600">
        {clip.end}
      </span>
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
    <label className="text-xs text-zinc-400">
      {label}
      <input
        type="number"
        className="mt-1 block w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm tabular-nums text-zinc-100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
