/** The visual cue used to place a mark — sets the mark's base trust. */
export type CueTag = "impactFlash" | "vfxEdge" | "animationBreak" | "estimate"

export const CUES: { tag: CueTag; label: string; hint: string }[] = [
  {
    tag: "impactFlash",
    label: "Impact flash",
    hint: "hit flash / damage number / hitstop",
  },
  {
    tag: "vfxEdge",
    label: "VFX edge",
    hint: "a skill effect or trail appears or clears",
  },
  {
    tag: "animationBreak",
    label: "Animation break",
    hint: "an abrupt pose or motion change",
  },
  {
    tag: "estimate",
    label: "Estimate",
    hint: "judgement call, no clean anchor",
  },
]

/** A reference to one of the picked character's stages — the shared solve identity. */
export interface StageRef {
  id: string
  skill: string
  stage: string
  hitCount: number
}

/** A divider between two consecutive stages — the stage-boundary mark (old "cutoff"). */
export interface Boundary {
  id: string
  /** Absolute clip-frame — the source of truth. The section widths derive from it. */
  frame: number
  cue: CueTag
}

/** A hit landing, at an absolute clip-frame. Its stage membership derives from position. */
export interface HitMark {
  id: string
  frame: number
  cue: CueTag
}

/** One action string: a contiguous stage sequence of known length, plus its marks. */
export interface Clip {
  id: string
  /** Explicit override; when empty the display name derives from the stage sequence. */
  name: string
  start: number
  end: number
  stageRefs: StageRef[]
  /** Internal dividers, positionally aligned: `boundaries[i]` splits stage i from i+1. Length = max(0, stageRefs.length - 1). */
  boundaries: Boundary[]
  hits: HitMark[]
}

export interface Section {
  ref: StageRef
  start: number
  end: number
}

/** Project the sequence onto the ruler as contiguous sections, bounded by start/dividers/end. */
export function sections(clip: Clip): Section[] {
  const bounds = [clip.start, ...clip.boundaries.map((b) => b.frame), clip.end]
  return clip.stageRefs.map((ref, i) => ({
    ref,
    start: bounds[i],
    end: bounds[i + 1],
  }))
}

export function clipDisplayName(clip: Clip): string {
  if (clip.name.trim()) return clip.name
  if (clip.stageRefs.length === 0) return "Untitled"
  return clip.stageRefs.map((s) => s.stage).join(" → ")
}
