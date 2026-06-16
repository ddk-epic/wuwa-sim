import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import type { EnrichedCharacter } from "#/types/character"
import { uid } from "../shared"
import type { Selected } from "../shared"
import type { StageGroup } from "../stages"
import { clipDisplayName } from "../types"
import type { Clip, ClipEdit, StageRef } from "../types"
import { AddStagePopover } from "./AddStagePopover"
import { EmitPanel } from "./EmitPanel"
import { MarksTable } from "./MarksTable"
import { Ruler } from "./Ruler"

export function ClipEditor({
  char,
  clip,
  groups,
  onEdit,
  onRemove,
}: {
  char: EnrichedCharacter
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

      <EmitPanel char={char} clip={clip} />
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
