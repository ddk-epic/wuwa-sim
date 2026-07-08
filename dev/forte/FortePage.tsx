import { useEffect, useMemo, useRef, useState } from "react"
import { Gauge, Plus, Table2 } from "lucide-react"
import { CHARACTERS, findCharacter, stageGroups } from "../frames/stages"
import { uid } from "../frames/shared"
import { useDebouncedSave } from "../frames/useDebouncedSave"
import {
  loadClips,
  loadSelectedCharacter,
  saveClips,
  saveSelectedCharacter,
} from "./storage"
import { applyForteEdit, clipDisplayName, rehydrateForteClips } from "./clip"
import type { ForteClip, ForteClipEdit } from "./clip"
import { ForteClipEditor } from "./components/ForteClipEditor"
import { SummaryModal } from "./components/SummaryModal"

function emptyClip(): ForteClip {
  return { id: uid(), name: "", start: 0, end: 60, stageRefs: [] }
}

export function FortePage() {
  const [characterName, setCharacterName] = useState(CHARACTERS[0]?.name ?? "")
  const [clips, setClips] = useState<ForteClip[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  // Mirrors `clips` synchronously so several edits in one handler compose.
  const clipsRef = useRef<ForteClip[]>([])

  // Persist off the edit hot path. Payload carries its own character so a write
  // that lands after a character switch still targets the right storage key.
  const { queue: queueSave, flush: flushSave } = useDebouncedSave(
    (w: { character: string; clips: ForteClip[] }) =>
      saveClips(w.character, w.clips),
    400,
  )

  const char = findCharacter(characterName)
  const groups = useMemo(() => (char ? stageGroups(char) : []), [char])
  const clip = clips.find((c) => c.id === selectedId) ?? null

  // Restore the saved character + clips after mount, not at init, so SSR and the
  // first client render stay identical. Unknown stored name falls back.
  useEffect(() => {
    const saved = loadSelectedCharacter()
    const name = (saved && findCharacter(saved)?.name) || characterName
    setCharacterName(name)
    loadInto(name)
  }, [])

  function loadInto(name: string) {
    flushSave()
    const c = findCharacter(name)
    const loaded = c ? rehydrateForteClips(loadClips(name), c) : loadClips(name)
    clipsRef.current = loaded
    setClips(loaded)
    setSelectedId(loaded[0]?.id ?? null)
  }

  // Every clip mutation funnels through here: reads update synchronously; the
  // storage write is debounced and flushed on switch/unload.
  function commit(next: ForteClip[]) {
    clipsRef.current = next
    setClips(next)
    queueSave({ character: characterName, clips: next })
  }

  function pickCharacter(name: string) {
    setCharacterName(name)
    saveSelectedCharacter(name)
    loadInto(name)
  }

  function addClip() {
    const c = emptyClip()
    commit([...clipsRef.current, c])
    setSelectedId(c.id)
  }

  function editClip(id: string, edit: ForteClipEdit): ForteClip {
    const next = applyForteEdit(
      clipsRef.current.find((c) => c.id === id)!,
      edit,
    )
    commit(clipsRef.current.map((c) => (c.id === id ? next : c)))
    return next
  }

  function removeClip(id: string) {
    const next = clipsRef.current.filter((c) => c.id !== id)
    commit(next)
    if (selectedId === id) setSelectedId(next[next.length - 1]?.id ?? null)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
        <Gauge className="size-5 text-muted-foreground" />
        <h1 className="text-sm font-semibold tracking-wide">Forte Tool</h1>
        <span className="font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
          /dev/forte
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

      <main className="min-h-0 flex-1 overflow-y-auto p-5">
        <h2 className="mb-4 text-title font-bold tracking-tight">
          {characterName}
        </h2>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-micro font-medium uppercase tracking-[1px] text-muted-foreground/70">
              Clips
            </p>
            <button
              onClick={() => setShowSummary(true)}
              disabled={clips.length === 0}
              className="flex items-center gap-1 rounded border border-border px-2.5 py-1 text-detail text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-40"
              title={
                clips.length === 0 ? "no clips yet" : "forte summary table"
              }
            >
              <Table2 className="size-3.5" /> Summary
            </button>
          </div>

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
          <ForteClipEditor
            key={clip.id}
            clip={clip}
            groups={groups}
            forteCap={char?.forteCap ?? 100}
            onEdit={(edit) => editClip(clip.id, edit)}
            onRemove={() => removeClip(clip.id)}
          />
        )}
      </main>

      {showSummary && (
        <SummaryModal
          clips={clips}
          forteCap={char?.forteCap ?? 100}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  )
}
