import type { EnrichedCharacter } from "#/types/character"
import { stageGroups } from "../frames/stages"
import type { StageRef } from "../frames/stage-ref"
import { clampPoint } from "./calibration"
import type { Calibration, Point } from "./calibration"

/**
 * One occurrence in the repeated sequence: its stage and an optional gauge
 * reading. `reading` is the raw fill-marker point (normalized canvas coords);
 * the gauge level projects through the clip's calibration, so re-calibrating
 * reflows it. `id` is stable across add/remove so the in-memory screenshot,
 * held only by the editor, stays pinned to its slot.
 */
export interface ForteSlot {
  id: string
  ref: StageRef
  reading?: Point
}

/**
 * One recording of a repeated stage sequence (`b1 b1 b1 b1`), captured as one
 * screenshot per occurrence. Each slot carries its own gauge reading; the
 * calibration axis is shared by every slot's screenshot.
 */
export interface ForteClip {
  id: string
  /** Explicit override; when empty the display name derives from the sequence. */
  name: string
  slots: ForteSlot[]
  /** The on-screen gauge's `empty→full` axis, normalized [0,1] screenshot coords. */
  calibration?: Calibration
  /** Freezes the sequence: no slot add/remove. */
  stagesLocked?: boolean
}

export function clipDisplayName(clip: ForteClip): string {
  if (clip.name.trim()) return clip.name
  if (clip.slots.length === 0) return "Untitled"
  return clip.slots.map((s) => s.ref.stage).join("›")
}

// Catalog-derived ref fields (hitCount, name) get baked into a slot at add time;
// the catalog is truth, so refresh them by id on load. Ids gone from the catalog
// (renamed/removed) keep the stored ref.
export function rehydrateForteClips(
  clips: ForteClip[],
  char: EnrichedCharacter,
): ForteClip[] {
  const catalog = new Map<string, StageRef>()
  for (const group of stageGroups(char))
    for (const ref of group.stages) catalog.set(ref.id, ref)
  return clips.map((clip) => ({
    ...clip,
    slots: clip.slots.map((slot) => ({
      ...slot,
      ref: catalog.get(slot.ref.id) ?? slot.ref,
    })),
  }))
}

/**
 * Every clip mutation, as a closed set. `applyForteEdit` is the only door to the
 * model. Structural edits no-op while `stagesLocked`.
 */
export type ForteClipEdit =
  | { type: "setName"; name: string }
  | { type: "toggleStagesLock" }
  | { type: "addStage"; id: string; ref: StageRef }
  | { type: "removeStage"; index: number }
  | { type: "setCalibration"; calibration: Calibration }
  | { type: "setReading"; index: number; fill: Point }
  | { type: "clearReading"; index: number }

// Edits that reshape the sequence, frozen while `stagesLocked`.
const STRUCTURE_EDITS = new Set<ForteClipEdit["type"]>([
  "addStage",
  "removeStage",
])

/** Apply one edit. Returns the clip unchanged when the edit is illegal. */
export function applyForteEdit(
  clip: ForteClip,
  edit: ForteClipEdit,
): ForteClip {
  if (clip.stagesLocked && STRUCTURE_EDITS.has(edit.type)) return clip
  switch (edit.type) {
    case "setName":
      return { ...clip, name: edit.name }
    case "toggleStagesLock":
      return { ...clip, stagesLocked: !clip.stagesLocked }
    case "addStage":
      return { ...clip, slots: [...clip.slots, { id: edit.id, ref: edit.ref }] }
    case "removeStage":
      return { ...clip, slots: clip.slots.filter((_, i) => i !== edit.index) }
    case "setCalibration":
      return { ...clip, calibration: edit.calibration }
    case "setReading":
      return {
        ...clip,
        slots: mapSlot(clip, edit.index, (s) => ({
          ...s,
          reading: clampPoint(edit.fill),
        })),
      }
    case "clearReading":
      return {
        ...clip,
        slots: mapSlot(clip, edit.index, (s) => ({ ...s, reading: undefined })),
      }
  }
}

function mapSlot(
  clip: ForteClip,
  index: number,
  fn: (s: ForteSlot) => ForteSlot,
): ForteSlot[] {
  return clip.slots.map((s, i) => (i === index ? fn(s) : s))
}
