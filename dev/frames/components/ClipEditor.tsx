import { useEffect, useState } from "react"
import {
  Crop,
  Crosshair,
  Lock,
  LockOpen,
  MoveHorizontal,
  SeparatorHorizontal,
  Trash2,
} from "lucide-react"
import { TRACK_COLS, clamp, uid } from "../shared"
import type { Selected } from "../shared"
import type { StageGroup } from "../stages"
import {
  clipDisplayName,
  hitsInStage,
  isPlaceholder,
  placeholderRef,
  stageCapacity,
  stageIndexOf,
} from "../types"
import type { Clip, ClipEdit, StageRef } from "../types"
import type { VideoSource } from "../video"
import { AddStagePopover } from "./AddStagePopover"
import { MarksTable } from "./MarksTable"
import { Ruler } from "./Ruler"
import { VideoPane } from "./VideoPane"

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
    // Fresh clip scopes the whole recording; a scoped one restores its window so
    // one Lock re-confirms it, keeping the entered marks.
    if (clip.offset == null) {
      onEdit({ type: "scopeRecording", frames: s.frameCount })
      setScoping(true)
      setPlayhead(0)
    } else {
      const next = onEdit({ type: "enterScope" })
      setScoping(true)
      setPlayhead(next.start)
    }
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
    // A spacer has no animation to split.
    if (isPlaceholder(clip.stageRefs[stageIndex])) return
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

  // A hit needs a stage at the playhead to own it; the rest zone has none, so
  // that alone disables the button. Over-capacity is allowed but warned: the
  // stage still owns the hit, it just reads as exceeding.
  const hitOwner = stageIndexOf(clip, playhead)
  const hitReason = hitOwner === -1 ? "no stage at the playhead" : null
  const overCapacity =
    hitOwner !== -1 &&
    hitsInStage(clip, hitOwner) >= stageCapacity(clip, hitOwner)

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
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
            }}
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
        onSetOut={(f) => onEdit({ type: "setScopeEnd", frame: f })}
        onLock={lock}
        onAttach={attach}
        storedSource={clip.source}
      />

      {!scoping && (
        <>
          <div className={`${TRACK_COLS} items-start`}>
            <div className="flex items-start justify-between pr-3">
              <AddStagePopover
                groups={groups}
                onAdd={(ref: StageRef) =>
                  onEdit({ type: "addStage", ref, boundaryId: uid() })
                }
              />
              <div className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border">
                <button
                  onClick={addHitHere}
                  disabled={hitReason != null}
                  className="relative p-1.5 text-muted-foreground hover:bg-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  title={
                    hitReason ??
                    (overCapacity
                      ? "over the recorded hit count — places anyway"
                      : "drop a hit at the playhead")
                  }
                >
                  <Crosshair className="size-4" />
                  {overCapacity && (
                    <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-destructive" />
                  )}
                </button>
                <button
                  onClick={addSplitHere}
                  className="p-1.5 text-muted-foreground hover:bg-border hover:text-foreground"
                  title="drop an animation split at the playhead"
                >
                  <SeparatorHorizontal className="size-4 rotate-90" />
                </button>
                <button
                  onClick={() =>
                    onEdit({
                      type: "addStage",
                      ref: placeholderRef(),
                      boundaryId: uid(),
                    })
                  }
                  className="p-1.5 text-muted-foreground hover:bg-border hover:text-foreground"
                  title="append a spacer to carve out a mid-rotation gap (jump/dodge)"
                >
                  <MoveHorizontal className="size-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Ruler
                clip={clip}
                selected={selected}
                setSelected={setSelected}
                onEdit={onEdit}
                playhead={playhead}
                onSeek={setPlayhead}
              />
              <div className="flex items-center justify-between gap-3 text-detail">
                <p className="text-muted-foreground/60">
                  Click the ruler to move the playhead; drag hits/dividers to
                  reposition.
                </p>
                {clip.stageRefs.length > 0 && (
                  <button
                    onClick={() => onEdit({ type: "toggleStagesLock" })}
                    className={`flex shrink-0 items-center gap-1 ${clip.stagesLocked ? "text-blue-400 hover:text-blue-300" : "text-muted-foreground/60 hover:text-foreground"}`}
                    title={
                      clip.stagesLocked
                        ? "unlock stages"
                        : "lock the stage dividers against accidental edits"
                    }
                  >
                    {clip.stagesLocked ? "stages locked!" : "lock stages"}
                    {clip.stagesLocked ? (
                      <Lock className="size-3.5" />
                    ) : (
                      <LockOpen className="size-3.5" />
                    )}
                  </button>
                )}
              </div>
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
