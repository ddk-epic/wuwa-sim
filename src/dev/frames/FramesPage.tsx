import { useEffect, useMemo, useState } from "react"
import { Film, Plus } from "lucide-react"
import { CHARACTERS, findCharacter, stageGroups } from "./stages"
import { loadClips, saveClips } from "./storage"
import { applyClipEdit, clipDisplayName } from "./types"
import type { Clip, ClipEdit } from "./types"
import { uid } from "./shared"
import { ClipEditor } from "./components/ClipEditor"
import { StageOverview } from "./components/StageOverview"

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
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
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

      <div className="grid min-h-0 flex-1 grid-cols-[16rem_1fr]">
        <aside className="min-h-0 overflow-hidden border-r border-border">
          <StageOverview groups={groups} clip={clip} />
        </aside>

        <main className="overflow-y-auto p-5">
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
