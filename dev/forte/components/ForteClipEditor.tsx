import { useEffect, useState } from "react"
import { Crop, Lock, LockOpen, Ruler, Trash2, X } from "lucide-react"
import { clamp } from "../../frames/shared"
import type { StageGroup } from "../../frames/stages"
import { AddStagePopover } from "../../frames/components/AddStagePopover"
import { VideoPane } from "../../frames/components/VideoPane"
import type { VideoSource } from "../../frames/video"
import { clipDisplayName } from "../clip"
import type { ForteClip, ForteClipEdit } from "../clip"
import type { StageRef } from "../../frames/stage-ref"
import { DEFAULT_CALIBRATION } from "../calibration"
import { CalibrationOverlay } from "./CalibrationOverlay"

export function ForteClipEditor({
  clip,
  groups,
  onEdit,
  onRemove,
}: {
  clip: ForteClip
  groups: StageGroup[]
  onEdit: (edit: ForteClipEdit) => ForteClip
  onRemove: () => void
}) {
  const [video, setVideo] = useState<VideoSource | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [scoping, setScoping] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [warn, setWarn] = useState<string | null>(null)

  // Dispose the decode pipeline when it's replaced or the editor unmounts (clip
  // switch remounts via key={clip.id}), closing the WebCodecs decoder.
  useEffect(() => () => video?.dispose(), [video])

  function attach(s: VideoSource) {
    setWarn(
      clip.source && clip.source !== s.fileName
        ? `This clip was measured against ${clip.source}; you attached ${s.fileName}.`
        : null,
    )
    onEdit({ type: "setSource", source: s.fileName })
    setVideo(s)
    // Fresh clip scopes the whole recording; a scoped one restores its window so
    // one Lock re-confirms it.
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

  // During scope the clip frames are absolute video frames (offset cleared), so
  // the canvas frame is the playhead itself; afterwards it's offset into the file.
  const videoFrame = playhead + (clip.offset ?? 0)
  const scrubHi = scoping ? (video ? video.frameCount - 1 : clip.end) : clip.end

  return (
    <div className="space-y-4">
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
        {video && !scoping && (
          <button
            onClick={() => {
              if (!clip.calibration)
                onEdit({
                  type: "setCalibration",
                  calibration: DEFAULT_CALIBRATION,
                })
              setCalibrating((c) => !c)
            }}
            className={`flex items-center gap-1 rounded border px-3 py-1 text-sm ${calibrating ? "border-sky-400 text-sky-400" : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"}`}
          >
            <Ruler className="size-3.5" />{" "}
            {calibrating ? "Done" : "Calibrate bar"}
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
        overlay={
          calibrating && !scoping && clip.calibration ? (
            <CalibrationOverlay
              calibration={clip.calibration}
              onChange={(calibration) =>
                onEdit({ type: "setCalibration", calibration })
              }
            />
          ) : undefined
        }
      />

      {!scoping && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <AddStagePopover
              groups={groups}
              onAdd={(ref: StageRef) => onEdit({ type: "addStage", ref })}
            />
            {clip.stageRefs.length > 0 && (
              <button
                onClick={() => onEdit({ type: "toggleStagesLock" })}
                className={`flex shrink-0 items-center gap-1 text-detail ${clip.stagesLocked ? "text-blue-400 hover:text-blue-300" : "text-muted-foreground/60 hover:text-foreground"}`}
                title={
                  clip.stagesLocked
                    ? "unlock the sequence"
                    : "lock the sequence against accidental edits"
                }
              >
                {clip.stagesLocked ? "sequence locked!" : "lock sequence"}
                {clip.stagesLocked ? (
                  <Lock className="size-3.5" />
                ) : (
                  <LockOpen className="size-3.5" />
                )}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {clip.stageRefs.length === 0 && (
              <p className="text-detail text-muted-foreground">
                Add stages to author a repeated sequence.
              </p>
            )}
            {clip.stageRefs.map((ref, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-detail text-foreground"
              >
                {ref.stage}
                {!clip.stagesLocked && (
                  <button
                    onClick={() => onEdit({ type: "removeStage", index: i })}
                    className="text-muted-foreground/60 hover:text-destructive"
                    title="remove this stage"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Commits on blur/Enter, not per keystroke, so a mid-edit value isn't clamped.
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
