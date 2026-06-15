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
  return clip.stageRefs.map((s) => s.stage).join("›")
}

/**
 * Append a stage. A new divider is inserted at the midpoint of the old last
 * section so the new stage has room; the first stage adds no divider. Keeps
 * the invariant `boundaries.length === max(0, stageRefs.length - 1)`.
 */
export function appendStage(
  clip: Clip,
  ref: StageRef,
  boundaryId: string,
): Clip {
  const stageRefs = [...clip.stageRefs, ref]
  if (clip.stageRefs.length === 0) return { ...clip, stageRefs }
  const prev = clip.boundaries.length
    ? clip.boundaries[clip.boundaries.length - 1].frame
    : clip.start
  const frame = Math.round((prev + clip.end) / 2)
  return {
    ...clip,
    stageRefs,
    boundaries: [
      ...clip.boundaries,
      { id: boundaryId, frame, cue: "animationBreak" },
    ],
  }
}

/** Remove stage `i`, dropping the divider that adjoined it so the boundary-count invariant holds. */
export function removeStageAt(clip: Clip, i: number): Clip {
  const stageRefs = clip.stageRefs.filter((_, idx) => idx !== i)
  if (clip.boundaries.length === 0) return { ...clip, stageRefs }
  const bi = i >= clip.boundaries.length ? clip.boundaries.length - 1 : i
  return {
    ...clip,
    stageRefs,
    boundaries: clip.boundaries.filter((_, idx) => idx !== bi),
  }
}

/**
 * Which section (stage index) a frame falls in, or -1 if outside the clip. A
 * frame sitting exactly on a divider belongs to the later stage it opens; the
 * last stage owns its end frame.
 */
export function stageIndexOf(clip: Clip, frame: number): number {
  const secs = sections(clip)
  return secs.findIndex(
    (s, i) =>
      frame >= s.start &&
      (i === secs.length - 1 ? frame <= s.end : frame < s.end),
  )
}

/** How many hits currently land in stage `i`, by their frame position. */
export function hitsInStage(clip: Clip, stageIdx: number): number {
  return clip.hits.filter((h) => stageIndexOf(clip, h.frame) === stageIdx)
    .length
}

/** The hit capacity of stage `i` — its reference's recorded hit count, or 0. */
export function stageCapacity(clip: Clip, stageIdx: number): number {
  return clip.stageRefs[stageIdx]?.hitCount ?? 0
}

/** Hits grouped by the stage their frame lands in, each group ordered by frame. Index = stage index. */
export function hitsByStage(clip: Clip): HitMark[][] {
  const groups: HitMark[][] = clip.stageRefs.map(() => [])
  for (const h of clip.hits) {
    const i = stageIndexOf(clip, h.frame)
    if (i !== -1) groups[i].push(h)
  }
  for (const g of groups) g.sort((a, b) => a.frame - b.frame)
  return groups
}

/** Ids of the surplus hits — within each stage, the ones past its capacity, ordered by frame. */
export function exceedingHitIds(clip: Clip): Set<string> {
  const over = new Set<string>()
  hitsByStage(clip).forEach((hits, i) => {
    hits.slice(stageCapacity(clip, i)).forEach((h) => over.add(h.id))
  })
  return over
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

/**
 * Every clip mutation, as a closed set. `applyClipEdit` is the only door to the
 * model — the editor never reshapes a Clip in place — so structural invariants
 * (boundary count, hit capacity, divider ordering) are enforced in one place.
 * Frames arriving here are raw (the caller converts pixels to frames); clamping
 * to the legal range is the edit's job, not the caller's.
 */
export type ClipEdit =
  | { type: "setName"; name: string }
  | { type: "setStart"; frame: number }
  | { type: "setEnd"; frame: number }
  | { type: "addStage"; ref: StageRef; boundaryId: string }
  | { type: "removeStage"; index: number }
  | { type: "addHit"; hit: HitMark }
  | { type: "removeHit"; id: string }
  | { type: "moveHit"; id: string; frame: number }
  | { type: "setHitCue"; id: string; cue: CueTag }
  | { type: "moveBoundary"; index: number; frame: number }
  | { type: "setBoundaryCue"; id: string; cue: CueTag }

/** Apply one edit. Returns the clip unchanged when the edit is illegal (over capacity, no room for the divider). */
export function applyClipEdit(clip: Clip, edit: ClipEdit): Clip {
  switch (edit.type) {
    case "setName":
      return { ...clip, name: edit.name }
    case "setStart":
      return { ...clip, start: edit.frame }
    case "setEnd":
      return { ...clip, end: edit.frame }
    case "addStage":
      return appendStage(clip, edit.ref, edit.boundaryId)
    case "removeStage":
      return removeStageAt(clip, edit.index)
    case "addHit": {
      const frame = clamp(edit.hit.frame, clip.start, clip.end)
      const stage = stageIndexOf(clip, frame)
      if (
        stage === -1 ||
        hitsInStage(clip, stage) >= stageCapacity(clip, stage)
      )
        return clip
      return { ...clip, hits: [...clip.hits, { ...edit.hit, frame }] }
    }
    case "removeHit":
      return { ...clip, hits: clip.hits.filter((h) => h.id !== edit.id) }
    case "moveHit": {
      const hit = clip.hits.find((h) => h.id === edit.id)
      if (!hit) return clip
      const frame = clamp(edit.frame, clip.start, clip.end)
      const from = stageIndexOf(clip, hit.frame)
      const to = stageIndexOf(clip, frame)
      if (to !== from && hitsInStage(clip, to) >= stageCapacity(clip, to))
        return clip
      return {
        ...clip,
        hits: clip.hits.map((h) => (h.id === edit.id ? { ...h, frame } : h)),
      }
    }
    case "setHitCue":
      return {
        ...clip,
        hits: clip.hits.map((h) =>
          h.id === edit.id ? { ...h, cue: edit.cue } : h,
        ),
      }
    case "moveBoundary": {
      const { index: i } = edit
      const min = (i > 0 ? clip.boundaries[i - 1].frame : clip.start) + 1
      const max =
        (i < clip.boundaries.length - 1
          ? clip.boundaries[i + 1].frame
          : clip.end) - 1
      if (max < min) return clip
      const frame = clamp(edit.frame, min, max)
      return {
        ...clip,
        boundaries: clip.boundaries.map((b, idx) =>
          idx === i ? { ...b, frame } : b,
        ),
      }
    }
    case "setBoundaryCue":
      return {
        ...clip,
        boundaries: clip.boundaries.map((b) =>
          b.id === edit.id ? { ...b, cue: edit.cue } : b,
        ),
      }
  }
}
