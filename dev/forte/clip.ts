import type { EnrichedCharacter } from "#/types/character"
import { stageGroups } from "../frames/stages"
import type { StageRef } from "../frames/types"

export type { StageRef } from "../frames/types"

/**
 * One recording of a repeated stage sequence (`b1 b1 b1 b1`). The foundation
 * slice authors the sequence and scopes the footage; calibration and forte
 * separators land in later phases. No shared state with the timing `Clip`.
 */
export interface ForteClip {
  id: string
  /** Explicit override; when empty the display name derives from the sequence. */
  name: string
  start: number
  end: number
  stageRefs: StageRef[]
  /** Filename of the recording these frames were read against, provenance only. */
  source?: string
  /** Absolute video frame that clip-frame 0 maps to, captured at scope lock-in. */
  offset?: number
  /** Freezes the sequence: no stage add/remove. */
  stagesLocked?: boolean
}

export function clipDisplayName(clip: ForteClip): string {
  if (clip.name.trim()) return clip.name
  if (clip.stageRefs.length === 0) return "Untitled"
  return clip.stageRefs.map((s) => s.stage).join("›")
}

// Catalog-derived fields (hitCount, name) get baked into a clip's stored refs at
// add time; the catalog is truth, so refresh them by id on load. Ids gone from
// the catalog (renamed/removed) keep the stored ref.
export function rehydrateForteClips(
  clips: ForteClip[],
  char: EnrichedCharacter,
): ForteClip[] {
  const catalog = new Map<string, StageRef>()
  for (const group of stageGroups(char))
    for (const ref of group.stages) catalog.set(ref.id, ref)
  return clips.map((clip) => ({
    ...clip,
    stageRefs: clip.stageRefs.map((ref) => catalog.get(ref.id) ?? ref),
  }))
}

/**
 * Every clip mutation, as a closed set. `applyForteEdit` is the only door to the
 * model. Frames arriving here are raw; clamping to the legal range is the edit's
 * job. Structural edits no-op while `stagesLocked`.
 */
export type ForteClipEdit =
  | { type: "setName"; name: string }
  | { type: "setSource"; source: string }
  | { type: "toggleStagesLock" }
  | { type: "scopeRecording"; frames: number }
  | { type: "enterScope" }
  | { type: "lockScope" }
  | { type: "setStart"; frame: number }
  | { type: "setScopeEnd"; frame: number }
  | { type: "setEnd"; frame: number }
  | { type: "addStage"; ref: StageRef }
  | { type: "removeStage"; index: number }

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
    case "setSource":
      return { ...clip, source: edit.source }
    case "toggleStagesLock":
      return { ...clip, stagesLocked: !clip.stagesLocked }
    case "scopeRecording":
      // Window is the whole recording (absolute frames), not the sequence.
      return { ...clip, start: 0, end: edit.frames - 1, offset: undefined }
    case "enterScope":
      // Re-scope: lift start/end into absolute video-frame space. Inverse of lock.
      return clip.offset != null
        ? {
            ...clip,
            start: clip.start + clip.offset,
            end: clip.end + clip.offset,
            offset: undefined,
          }
        : clip
    case "lockScope": {
      // Normalize: clip-frame 0 is the in-cut (kept as offset), length is out − in.
      const length = clip.end - clip.start
      return { ...clip, start: 0, end: length, offset: clip.start }
    }
    case "setStart":
      return { ...clip, start: edit.frame }
    case "setScopeEnd":
      // Out-cut in absolute space; no content floor.
      return { ...clip, end: Math.max(edit.frame, clip.start + 1) }
    case "setEnd":
      return { ...clip, end: Math.max(edit.frame, clip.start + 1) }
    case "addStage":
      return { ...clip, stageRefs: [...clip.stageRefs, edit.ref] }
    case "removeStage":
      return {
        ...clip,
        stageRefs: clip.stageRefs.filter((_, i) => i !== edit.index),
      }
  }
}
