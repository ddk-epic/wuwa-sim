import { useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  Lock,
  LockOpen,
  Ruler,
  Trash2,
} from "lucide-react"
import { TRACK_COLS, clamp, uid } from "../../frames/shared"
import type { StageGroup } from "../../frames/stages"
import { AddStagePopover } from "../../frames/components/AddStagePopover"
import { FrameTrack, TrackMarker } from "../../frames/components/FrameTrack"
import type { StageRef } from "../../frames/stage-ref"
import { DEFAULT_CALIBRATION } from "../calibration"
import type { Point } from "../calibration"
import { clipDisplayName } from "../clip"
import type { ForteClip, ForteClipEdit } from "../clip"
import { reconcileForte } from "../reconcile"
import { CalibrationOverlay } from "./CalibrationOverlay"
import { FillOverlay } from "./FillOverlay"
import { ForteRuler } from "./ForteRuler"
import { ScreenshotHolder } from "./ScreenshotHolder"

// Midpoint of the calibrated bar: where a fresh fill marker starts.
function barMidpoint(clip: ForteClip): Point {
  const cal = clip.calibration ?? DEFAULT_CALIBRATION
  return {
    x: (cal.empty.x + cal.full.x) / 2,
    y: (cal.empty.y + cal.full.y) / 2,
  }
}

export function ForteClipEditor({
  clip,
  groups,
  forteCap,
  onEdit,
  onRemove,
}: {
  clip: ForteClip
  groups: StageGroup[]
  forteCap: number
  onEdit: (edit: ForteClipEdit) => ForteClip
  onRemove: () => void
}) {
  const [selected, setSelected] = useState(0)
  const [calibrating, setCalibrating] = useState(false)
  const [measuring, setMeasuring] = useState(false)
  // Screenshots live only here: dropped when the clip switch remounts the editor.
  const [shots, setShots] = useState<Record<string, string>>({})

  const count = clip.slots.length
  const sel = count === 0 ? 0 : clamp(selected, 0, count - 1)
  // `.at` yields undefined when the sequence is empty; plain indexing wouldn't.
  const slot = clip.slots.at(sel)
  const slotId = slot?.id
  const image = slot ? (shots[slot.id] ?? null) : null

  // Paste targets whichever slot is selected, regardless of focus.
  useEffect(() => {
    if (!slotId) return
    const id = slotId
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((it) =>
        it.type.startsWith("image/"),
      )
      const file = item?.getAsFile()
      if (!file) return
      e.preventDefault()
      const reader = new FileReader()
      reader.onload = () =>
        setShots((prev) => ({ ...prev, [id]: String(reader.result) }))
      reader.readAsDataURL(file)
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [slotId])

  function setImage(dataUrl: string) {
    if (slot) setShots((prev) => ({ ...prev, [slot.id]: dataUrl }))
  }

  const reading = reconcileForte(clip, forteCap)
  // Once calibrated, the bar stays on screen in every mode: interactive to
  // calibrate, a live marker to measure, else a read-only reference.
  const cal = clip.calibration
  let overlay: React.ReactNode = undefined
  if (image && calibrating)
    overlay = (
      <CalibrationOverlay
        calibration={cal ?? DEFAULT_CALIBRATION}
        onChange={(c) => onEdit({ type: "setCalibration", calibration: c })}
      />
    )
  else if (image && cal && measuring)
    overlay = (
      <FillOverlay
        calibration={cal}
        fill={slot?.reading ?? barMidpoint(clip)}
        onChange={(f) => onEdit({ type: "setReading", index: sel, fill: f })}
      />
    )
  else if (image && cal)
    overlay = <FillOverlay calibration={cal} fill={slot?.reading} readOnly />

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
        <button
          onClick={onRemove}
          className="ml-auto flex items-center gap-1 rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" /> Delete clip
        </button>
      </div>

      <ScreenshotHolder image={image} onImage={setImage} overlay={overlay} />

      <div className={`${TRACK_COLS} items-center`}>
        <div className="flex items-center gap-0.75 pr-3">
          <StepButton
            onClick={() => setSelected(clamp(sel - 1, 0, count - 1))}
            disabled={sel <= 0}
            title="previous occurrence"
          >
            <ChevronLeft className="size-4" />
          </StepButton>
          <span className="min-w-[5ch] text-center font-mono text-sm tabular-nums">
            {count === 0 ? "-" : `${sel + 1}/${count}`}
          </span>
          <StepButton
            onClick={() => setSelected(clamp(sel + 1, 0, count - 1))}
            disabled={sel >= count - 1}
            title="next occurrence"
          >
            <ChevronRight className="size-4" />
          </StepButton>
        </div>
        <FrameTrack
          lo={0}
          hi={Math.max(0, count - 1)}
          onScrub={setSelected}
          className="relative h-6 cursor-ew-resize rounded border border-border bg-border/30"
        >
          <TrackMarker
            frame={sel}
            className="pointer-events-none absolute top-0 h-full w-px -translate-x-1/2 bg-foreground"
          />
        </FrameTrack>
      </div>

      <div className={`${TRACK_COLS} items-start`}>
        <div className="flex flex-col items-start gap-2 pr-3">
          <AddStagePopover
            groups={groups}
            onAdd={(ref: StageRef) =>
              onEdit({ type: "addStage", id: uid(), ref })
            }
          />
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border">
            <ToolToggle
              active={calibrating}
              disabled={!image}
              activeClass="text-sky-400"
              title="calibrate the gauge bar"
              onClick={() => {
                if (!clip.calibration)
                  onEdit({
                    type: "setCalibration",
                    calibration: DEFAULT_CALIBRATION,
                  })
                setMeasuring(false)
                setCalibrating((c) => !c)
              }}
            >
              <Ruler className="size-4" />
            </ToolToggle>
            <ToolToggle
              active={measuring}
              disabled={!image || !clip.calibration}
              activeClass="text-amber-400"
              title="mark the gauge fill on this screenshot"
              onClick={() => {
                setCalibrating(false)
                setMeasuring((m) => !m)
              }}
            >
              <Gauge className="size-4" />
            </ToolToggle>
          </div>
        </div>

        <div className="space-y-2">
          <ForteRuler
            clip={clip}
            forteCap={forteCap}
            selected={sel}
            onSelect={setSelected}
            shotIds={new Set(Object.keys(shots))}
            onEdit={onEdit}
          />
          <div className="flex items-center justify-between gap-3 text-detail">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-micro font-medium uppercase tracking-[1px] text-muted-foreground/70">
                forte per entry:
              </span>
              {reading.status === "measured" ? (
                <span className="font-mono tabular-nums text-foreground">
                  {reading.mean.toFixed(1)}
                  <span className="text-muted-foreground/70">
                    {" "}
                    ± {reading.spread.toFixed(1)}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground/60">unmeasured</span>
              )}
            </div>
            {count > 0 && (
              <button
                onClick={() => onEdit({ type: "toggleStagesLock" })}
                className={`flex shrink-0 items-center gap-1 ${clip.stagesLocked ? "text-blue-400 hover:text-blue-300" : "text-muted-foreground/60 hover:text-foreground"}`}
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
        </div>
      </div>
    </div>
  )
}

function ToolToggle({
  active,
  disabled,
  activeClass,
  title,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  activeClass: string
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 hover:bg-border disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${active ? activeClass : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  )
}

function StepButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded border border-border p-1 text-muted-foreground hover:border-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  )
}
