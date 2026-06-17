import { useEffect, useState } from "react"
import { Crop, Plus, Trash2 } from "lucide-react"
import { TRACK_COLS, uid } from "../shared"
import type { Selected } from "../shared"
import type { StageGroup } from "../stages"
import { clipDisplayName, stageIndexOf } from "../types"
import type { Clip, ClipEdit, StageRef } from "../types"
import type { VideoSource } from "../video"
import { AddStagePopover } from "./AddStagePopover"
import { MarksTable } from "./MarksTable"
import { Ruler } from "./Ruler"
import { VideoPane } from "./VideoPane"

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

export function ClipEditor({
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
  const [video, setVideo] = useState<VideoSource | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [scoping, setScoping] = useState(false)
  const [warn, setWarn] = useState<string | null>(null)

  // Dispose the decode pipeline when it's replaced or the editor unmounts (clip
  // switch remounts via key={clip.id}), closing the WebCodecs decoder.
  useEffect(() => () => video?.dispose(), [video])

  // Selecting a mark seeks the video to it — the ruler→video half of the sync.
  // Skipped while scoping, where the playhead lives in absolute recording space.
  useEffect(() => {
    if (!selected || scoping) return
    const mark =
      selected.type === "split"
        ? (clip.animationSplits?.[selected.index] ?? undefined)
        : selected.type === "hit"
          ? clip.hits.find((h) => h.id === selected.id)
          : clip.boundaries.find((b) => b.id === selected.id)
    if (mark) setPlayhead(mark.frame)
  }, [selected, scoping, clip.hits, clip.boundaries, clip.animationSplits])

  function attach(s: VideoSource) {
    setWarn(
      clip.source && clip.source !== s.fileName
        ? `This clip was measured against ${clip.source}; you attached ${s.fileName}.`
        : null,
    )
    onEdit({ type: "setSource", source: s.fileName })
    setVideo(s)
    // A never-scoped clip drops into scoping with the window spanning the whole
    // recording (so the cut handles sit at the track edges, dragged inward); an
    // already-locked one (offset present) realigns silently to the same file.
    const fresh = clip.offset == null
    if (fresh) onEdit({ type: "setEnd", frame: s.frameCount - 1 })
    setScoping(fresh)
    setPlayhead(0)
  }

  function reScope() {
    const next = onEdit({ type: "enterScope" })
    setScoping(true)
    setPlayhead(next.start)
  }

  function lock() {
    onEdit({ type: "lockScope" })
    setScoping(false)
    setPlayhead(0)
  }

  function addHitHere() {
    const id = uid()
    const next = onEdit({
      type: "addHit",
      hit: { id, frame: playhead, cue: "impactFlash" },
    })
    if (next.hits.some((h) => h.id === id)) setSelected({ type: "hit", id })
  }

  function addSplitHere() {
    const stageIndex = stageIndexOf(clip, playhead)
    if (stageIndex === -1) return
    onEdit({
      type: "setAnimationSplit",
      stageIndex,
      frame: playhead,
      cue: "vfxEdge",
    })
    setSelected({ type: "split", index: stageIndex })
  }

  // During scope the clip frames are absolute video frames (offset cleared), so
  // the canvas frame is the playhead itself; afterwards it's offset into the file.
  const videoFrame = playhead + (clip.offset ?? 0)
  const scrubHi = scoping ? (video ? video.frameCount - 1 : clip.end) : clip.end

  return (
    <div className="space-y-4" onPointerDown={() => setSelected(null)}>
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
        {!scoping && (
          <FrameField
            label="Length"
            value={clip.end}
            onChange={(v) => onEdit({ type: "setEnd", frame: v })}
          />
        )}
        {video && !scoping && (
          <button
            onClick={reScope}
            className="flex items-center gap-1 rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:border-muted-foreground hover:text-foreground"
          >
            <Crop className="size-3.5" /> Re-scope
          </button>
        )}
        <button
          onClick={onRemove}
          className="ml-auto flex items-center gap-1 rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" /> Delete clip
        </button>
      </div>

      {warn && <p className="text-detail text-amber-500">{warn}</p>}

      <VideoPane
        source={video}
        videoFrame={videoFrame}
        playhead={playhead}
        setPlayhead={setPlayhead}
        lo={0}
        hi={scrubHi}
        scoping={scoping}
        inCut={clip.start}
        outCut={clip.end}
        onSetIn={(f) =>
          onEdit({ type: "setStart", frame: clamp(f, 0, clip.end - 1) })
        }
        onSetOut={(f) => onEdit({ type: "setEnd", frame: f })}
        onLock={lock}
        onAttach={attach}
        storedSource={clip.source}
      />

      {!scoping && (
        <>
          <div className={`${TRACK_COLS} items-start`}>
            <div className="flex w-fit flex-col gap-2">
              <div className="flex items-center gap-3">
                <AddStagePopover
                  groups={groups}
                  onAdd={(ref: StageRef) =>
                    onEdit({ type: "addStage", ref, boundaryId: uid() })
                  }
                />
                <button
                  onClick={addHitHere}
                  className="flex items-center gap-0.5 rounded border border-border pl-2 pr-2.5 py-1 text-sm text-foreground hover:border-muted-foreground"
                  title="drop a hit at the playhead"
                >
                  <Plus className="size-4" /> Hit
                </button>
              </div>
              <button
                onClick={addSplitHere}
                className="flex items-center gap-0.5 self-end rounded border border-border pl-2 pr-2.5 py-1 text-sm text-foreground hover:border-muted-foreground"
                title="drop an animation split at the playhead"
              >
                <Plus className="size-4" /> Anim split
              </button>
            </div>
            <div className="space-y-1">
              <Ruler
                clip={clip}
                selected={selected}
                setSelected={setSelected}
                onEdit={onEdit}
                playhead={playhead}
                onSeek={(f) => setPlayhead(clamp(f, 0, clip.end))}
              />
              <p className="text-detail text-muted-foreground/60">
                Click the ruler to move the playhead; drag hits/dividers to
                reposition.
              </p>
            </div>
          </div>

          <MarksTable
            clip={clip}
            selected={selected}
            setSelected={setSelected}
            onEdit={onEdit}
            playhead={playhead}
            hasVideo={video != null}
          />
        </>
      )}
    </div>
  )
}

// Commits on blur/Enter, not per keystroke: the parent clamps the value (End
// floors to its content), and an eager per-keystroke commit would clamp the first
// typed digit and clobber the rest of the number mid-edit.
function FrameField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [editing, setEditing] = useState(false)

  // Mirror external changes only while the user isn't mid-edit.
  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [value, editing])

  function commit() {
    setEditing(false)
    const n = Number(draft)
    if (draft.trim() === "" || !Number.isFinite(n)) setDraft(String(value))
    else onChange(n)
  }

  return (
    <label className="text-detail text-muted-foreground">
      {label}
      <input
        type="number"
        className="mt-1 block w-18 rounded border border-border bg-card px-2 py-1 text-sm tabular-nums text-foreground"
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
        }}
      />
    </label>
  )
}
