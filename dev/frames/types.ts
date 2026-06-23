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
  /** Registry stage carries `animationFrames` — a cutscene whose timing needs a split. */
  expectsSplit?: boolean
}

// A spacer occupies frames between two real stages (a mid-rotation jump/dodge)
// so their measured `actionTime` isn't inflated by the gap. It carries no
// catalog identity: invisible to the sidebar and export, owns no hits.
export const PLACEHOLDER_ID = "__placeholder__"

export const isPlaceholder = (ref: StageRef): boolean =>
  ref.id === PLACEHOLDER_ID

export function placeholderRef(): StageRef {
  return { id: PLACEHOLDER_ID, skill: "", stage: "spacer", hitCount: 0 }
}

/** A divider between two consecutive stages — the stage-boundary mark (old "cutoff"). */
export interface Boundary {
  id: string
  /** Absolute clip-frame — the source of truth. The section widths derive from it. */
  frame: number
  cue: CueTag
}

/** A hit landing, at an absolute clip-frame. */
export interface HitMark {
  id: string
  frame: number
  cue: CueTag
  /**
   * The stage that caused this hit, as an absolute stage index — sticky, set when
   * the hit is placed and never moved by dragging the frame. Delayed (trailing)
   * damage lands inside a later stage's frames while owned by an earlier one, so
   * ownership can't be read off position; dragging a hit across a boundary leaves
   * the owner put and surfaces the displacement as a badge.
   */
  owner: number
}

/** Per-stage split: footage left of `frame` is frozen `animationFrames`, right is the running `actionTime`. */
export interface AnimationSplit {
  frame: number
  cue: CueTag
}

/** The two authorable variant tracks. `instantCancel` is derived (cancel pinned to start), never authored directly. */
export type VariantTrack = "cancel" | "swap"

/**
 * Where a variant commits, as an ordinal — never a frame, so the marks-are-truth
 * invariant holds. `last` is a live sentinel (the highest-`actionFrame` placed hit
 * at resolve time), tracking hits as they're added; `start` resolves to 0.
 */
export type VariantTarget =
  | { kind: "start" }
  | { kind: "last" }
  | { kind: "hit"; n: number } // 1-based ordinal within the owning stage

export interface StageVariantPins {
  cancel?: VariantTarget
  swap?: VariantTarget
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
  /**
   * Where the stage sequence stops and the trailing rest zone begins, when one
   * exists. Born only when the last stage is deleted (the vacated boundary's
   * frame), so the survivor doesn't stretch over the gap; `(restStart, end]` is a
   * placeholder that owns nothing and is overwritten when a stage is appended.
   * Absent means the last stage fills to `end` (the common, no-recovery case).
   */
  restStart?: number
  /**
   * Authored variant pins, keyed by stage-occurrence index. Ordinal targets only
   * (no frames), so the marks-are-truth invariant holds. Per-occurrence is an MVP
   * simplification — cross-clip identity reconciliation is the solver's concern.
   */
  variants?: Record<number, StageVariantPins>
  /** Splits aligned to `stageRefs`; a plain array (not a Record) so removal splices the slot out — no remap. */
  animationSplits?: (AnimationSplit | null)[]
  /**
   * Filename of the recording these frames were read against — provenance only.
   * The video itself is throwaway and never persisted; this label survives reload
   * so a re-attach can be checked against the file the marks actually came from.
   */
  source?: string
  /**
   * Video-alignment metadata, never a clip coordinate: the absolute video frame
   * that clip-frame 0 maps to (`videoFrame = clipFrame + offset`), captured at
   * scope lock-in. The clip itself is always 0-based; this only realigns the
   * overlay so a re-attach of the same recording doesn't need re-scoping.
   */
  offset?: number
  /** Freezes the stage skeleton: no divider move/remove, no stage add/remove. Marks stay editable. */
  stagesLocked?: boolean
}

export interface Section {
  ref: StageRef
  start: number
  end: number
}

/**
 * Project the sequence onto the ruler as contiguous sections, bounded by
 * start/dividers and then `restStart` (when a rest zone exists) or `end`. The
 * rest zone itself is not a section — it owns nothing and is rendered separately.
 */
export function sections(clip: Clip): Section[] {
  const tail = clip.restStart ?? clip.end
  const bounds = [clip.start, ...clip.boundaries.map((b) => b.frame), tail]
  return clip.stageRefs.map((ref, i) => ({
    ref,
    start: bounds[i],
    end: bounds[i + 1],
  }))
}

// Keep mark positions through scoping; only pull off-ruler ones back in.
function clampContentToLength(clip: Clip, length: number): Clip {
  return {
    ...clip,
    boundaries: clip.boundaries.map((b) => ({
      ...b,
      frame: clamp(b.frame, 0, length),
    })),
    hits: clip.hits.map((h) => ({ ...h, frame: clamp(h.frame, 0, length) })),
    restStart:
      clip.restStart != null ? clamp(clip.restStart, 0, length) : undefined,
  }
}

export function animationSplitOf(clip: Clip, i: number): AnimationSplit | null {
  return clip.animationSplits?.[i] ?? null
}

export interface StageTiming {
  /** The split frame — the stage's engine-clock origin; the section start when unsplit. */
  animEnd: number
  animationFrames: number
  actionTime: number
}

/** Split a stage's section at `animEnd`; unsplit, `animationFrames` is 0 and `actionTime` the full width. */
export function stageTiming(
  clip: Clip,
  i: number,
  secs: Section[] = sections(clip),
): StageTiming {
  const sec = secs[i]
  const split = clip.animationSplits?.[i] ?? null
  const animEnd = split ? clamp(split.frame, sec.start, sec.end) : sec.start
  return {
    animEnd,
    animationFrames: animEnd - sec.start,
    actionTime: sec.end - animEnd,
  }
}

export function clipDisplayName(clip: Clip): string {
  if (clip.name.trim()) return clip.name
  const named = clip.stageRefs.filter((s) => !isPlaceholder(s))
  if (named.length === 0) return "Untitled"
  return named.map((s) => s.stage).join("›")
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
  const animationSplits = appendSplitSlot(clip.animationSplits)
  if (clip.stageRefs.length === 0)
    return { ...clip, stageRefs, animationSplits }
  const prev = clip.boundaries.length
    ? clip.boundaries[clip.boundaries.length - 1].frame
    : clip.start
  const frame = Math.round((prev + clip.end) / 2)
  return {
    ...clip,
    stageRefs,
    animationSplits,
    boundaries: [
      ...clip.boundaries,
      { id: boundaryId, frame, cue: "animationBreak" },
    ],
  }
}

function appendSplitSlot(
  splits: (AnimationSplit | null)[] | undefined,
): (AnimationSplit | null)[] | undefined {
  return splits ? [...splits, null] : undefined
}

/** Drop stage `i`'s slot, collapsing to absent once no split remains. */
function removeSplitSlot(
  splits: (AnimationSplit | null)[] | undefined,
  i: number,
): (AnimationSplit | null)[] | undefined {
  if (!splits) return undefined
  const next = splits.filter((_, idx) => idx !== i)
  return next.some((s) => s != null) ? next : undefined
}

/** Remove stage `i`, dropping the divider that adjoined it so the boundary-count invariant holds. */
export function removeStageAt(clip: Clip, i: number): Clip {
  const stageRefs = clip.stageRefs.filter((_, idx) => idx !== i)
  const animationSplits = removeSplitSlot(clip.animationSplits, i)
  if (clip.boundaries.length === 0)
    return { ...clip, stageRefs, animationSplits }
  const bi = i >= clip.boundaries.length ? clip.boundaries.length - 1 : i
  return {
    ...clip,
    stageRefs,
    animationSplits,
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

/**
 * The stage a hit is owned by — its stored `owner`, clamped to the clip's stages
 * as a guard against a stale index. Returns -1 only when the clip has no stages.
 * This is the membership everything downstream counts against, independent of
 * where the hit's frame currently sits.
 */
export function ownerIndexOf(clip: Clip, hit: HitMark): number {
  if (clip.stageRefs.length === 0) return -1
  return clamp(hit.owner, 0, clip.stageRefs.length - 1)
}

/** How many hits are owned by stage `i`. */
export function hitsInStage(clip: Clip, stageIdx: number): number {
  return clip.hits.filter((h) => ownerIndexOf(clip, h) === stageIdx).length
}

/** The hit capacity of stage `i` — its reference's recorded hit count, or 0. */
export function stageCapacity(clip: Clip, stageIdx: number): number {
  return clip.stageRefs[stageIdx]?.hitCount ?? 0
}

/** Hits grouped by the stage that owns them, each group ordered by frame. Index = stage index. */
export function hitsByStage(clip: Clip): HitMark[][] {
  const groups: HitMark[][] = clip.stageRefs.map(() => [])
  for (const h of clip.hits) {
    const i = ownerIndexOf(clip, h)
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

export type VariantResolution =
  | { ok: true; actionTime: number }
  | { ok: false; reason: string }

/**
 * Project a variant pin to its `actionTime` against the clip's own hits. `start`
 * is always 0; `last`/`hit` read the owner's placed hits (sorted by frame) and
 * fail (`ok: false`) when the target hit isn't present — an opted-in but
 * unresolved variant the caller drops from the export and surfaces as a warning.
 */
export function resolveVariantTarget(
  clip: Clip,
  stageIndex: number,
  target: VariantTarget,
): VariantResolution {
  if (target.kind === "start") return { ok: true, actionTime: 0 }
  const secs = sections(clip)
  if (stageIndex < 0 || stageIndex >= secs.length)
    return { ok: false, reason: "stage out of range" }
  const hits = hitsByStage(clip)[stageIndex]
  const index = target.kind === "last" ? hits.length - 1 : target.n - 1
  if (index < 0 || index >= hits.length)
    return {
      ok: false,
      reason:
        target.kind === "last"
          ? "no hits to pin to"
          : `hit ${target.n} not placed`,
    }
  return { ok: true, actionTime: hits[index].frame - secs[stageIndex].start }
}

/** Drop the removed stage's pins and shift higher occurrence keys down by one. */
function remapVariantsForRemoval(
  variants: Record<number, StageVariantPins> | undefined,
  removed: number,
): Record<number, StageVariantPins> | undefined {
  if (!variants) return undefined
  const next: Record<number, StageVariantPins> = {}
  for (const [key, pins] of Object.entries(variants)) {
    const idx = Number(key)
    if (idx === removed) continue
    next[idx > removed ? idx - 1 : idx] = pins
  }
  return Object.keys(next).length ? next : undefined
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

/** Write stage `i`'s split, clamped inside its section so `animationFrames ≥ 1` (the lock may be 0). */
function placeSplit(clip: Clip, i: number, frame: number, cue: CueTag): Clip {
  if (i < 0 || i >= clip.stageRefs.length) return clip
  const sec = sections(clip)[i]
  if (sec.end <= sec.start) return clip
  const slot: AnimationSplit = {
    frame: clamp(frame, sec.start + 1, sec.end),
    cue,
  }
  const slots = clip.stageRefs.map((_, idx) =>
    idx === i ? slot : (clip.animationSplits?.[idx] ?? null),
  )
  return { ...clip, animationSplits: slots }
}

/**
 * Every clip mutation, as a closed set. `applyClipEdit` is the only door to the
 * model — the editor never reshapes a Clip in place — so structural invariants
 * (boundary count, hit capacity, divider ordering) are enforced in one place.
 * Frames arriving here are raw (the caller converts pixels to frames); clamping
 * to the legal range is the edit's job, not the caller's.
 */
export type ClipEdit =
  | { type: "setName"; name: string }
  | { type: "setSource"; source: string }
  | { type: "toggleStagesLock" }
  | { type: "scopeRecording"; frames: number }
  | { type: "enterScope" }
  | { type: "lockScope" }
  | { type: "setStart"; frame: number }
  | { type: "setEnd"; frame: number }
  | { type: "setScopeEnd"; frame: number }
  | { type: "addStage"; ref: StageRef; boundaryId: string }
  | { type: "removeStage"; index: number }
  | { type: "addHit"; hit: Omit<HitMark, "owner"> }
  | { type: "removeHit"; id: string }
  | { type: "moveHit"; id: string; frame: number }
  | { type: "setHitCue"; id: string; cue: CueTag }
  | { type: "moveBoundary"; index: number; frame: number }
  | { type: "moveRestStart"; frame: number }
  | { type: "removeRestZone" }
  | { type: "setBoundaryCue"; id: string; cue: CueTag }
  | {
      type: "setVariant"
      stageIndex: number
      track: VariantTrack
      target: VariantTarget
    }
  | { type: "clearVariant"; stageIndex: number; track: VariantTrack }
  | {
      type: "setAnimationSplit"
      stageIndex: number
      frame: number
      cue: CueTag
    }
  | { type: "moveAnimationSplit"; stageIndex: number; frame: number }
  | { type: "setAnimationSplitCue"; stageIndex: number; cue: CueTag }
  | { type: "clearAnimationSplit"; stageIndex: number }

// Edits that reshape the stage skeleton — frozen while `stagesLocked`.
const STRUCTURE_EDITS = new Set<ClipEdit["type"]>([
  "addStage",
  "removeStage",
  "moveBoundary",
  "moveRestStart",
  "removeRestZone",
])

/** Apply one edit. Returns the clip unchanged when the edit is illegal (over capacity, no room for the divider). */
export function applyClipEdit(clip: Clip, edit: ClipEdit): Clip {
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
      // Re-scope: lift start/end into absolute video-frame space so the cut
      // handles sit where the recording does. Marks stay in 0-based clip space —
      // they're only ever authored there, never in absolute space. Inverse of lock.
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
      return clampContentToLength(
        { ...clip, start: 0, end: length, offset: clip.start },
        length,
      )
    }
    case "setStart":
      return { ...clip, start: edit.frame }
    case "setScopeEnd":
      // Out-cut in absolute space; no content floor, unlike `setEnd`.
      return { ...clip, end: Math.max(edit.frame, clip.start + 1) }
    case "setEnd": {
      // End can't cross inward of the content: the last divider, the rest-zone
      // start, or any hit — else the rest zone inverts or a hit orphans off-ruler.
      const lastBoundary = clip.boundaries.length
        ? clip.boundaries[clip.boundaries.length - 1].frame
        : clip.start
      const maxHit = clip.hits.reduce(
        (m, h) => Math.max(m, h.frame),
        clip.start,
      )
      const floor =
        Math.max(lastBoundary, clip.restStart ?? clip.start, maxHit) + 1
      return { ...clip, end: Math.max(edit.frame, floor) }
    }
    case "addStage": {
      // A rest zone is a placeholder: an appended stage overwrites it, taking
      // `[restStart, end]` with the old rest-start becoming its leading divider.
      if (clip.restStart != null && clip.stageRefs.length > 0) {
        return {
          ...clip,
          stageRefs: [...clip.stageRefs, edit.ref],
          animationSplits: appendSplitSlot(clip.animationSplits),
          boundaries: [
            ...clip.boundaries,
            {
              id: edit.boundaryId,
              frame: clip.restStart,
              cue: "animationBreak",
            },
          ],
          restStart: undefined,
        }
      }
      return appendStage(clip, edit.ref, edit.boundaryId)
    }
    case "removeStage": {
      const i = edit.index
      const isLast = i === clip.stageRefs.length - 1
      const sole = clip.stageRefs.length === 1
      // Removing the last stage leaves its leading divider as the rest-zone start
      // so the survivor keeps its measured length instead of stretching over the gap.
      const vacated =
        isLast && !sole
          ? clip.boundaries[clip.boundaries.length - 1].frame
          : undefined
      const reshaped = removeStageAt(clip, i)
      // Drop hits owned by the removed stage; shift owners past it down by one.
      const hits = clip.hits
        .filter((h) => ownerIndexOf(clip, h) !== i)
        .map((h) => {
          const o = ownerIndexOf(clip, h)
          return o > i ? { ...h, owner: o - 1 } : h
        })
      const restStart = sole ? undefined : isLast ? vacated : clip.restStart
      const variants = remapVariantsForRemoval(clip.variants, i)
      return { ...reshaped, hits, restStart, variants }
    }
    case "addHit": {
      // Placement sets ownership: a hit is born owned by the stage it lands in,
      // so clicking the rest zone (no stage) is rejected.
      const frame = clamp(edit.hit.frame, clip.start, clip.end)
      const owner = stageIndexOf(clip, frame)
      if (
        owner === -1 ||
        hitsInStage(clip, owner) >= stageCapacity(clip, owner)
      )
        return clip
      return { ...clip, hits: [...clip.hits, { ...edit.hit, frame, owner }] }
    }
    case "removeHit":
      return { ...clip, hits: clip.hits.filter((h) => h.id !== edit.id) }
    case "moveHit": {
      // Dragging moves only the frame; ownership is sticky, so a hit can cross a
      // boundary (becoming delayed) without re-homing and without a capacity check.
      const hit = clip.hits.find((h) => h.id === edit.id)
      if (!hit) return clip
      const frame = clamp(edit.frame, clip.start, clip.end)
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
      const upper =
        i < clip.boundaries.length - 1
          ? clip.boundaries[i + 1].frame
          : (clip.restStart ?? clip.end)
      const max = upper - 1
      if (max < min) return clip
      const frame = clamp(edit.frame, min, max)
      return {
        ...clip,
        boundaries: clip.boundaries.map((b, idx) =>
          idx === i ? { ...b, frame } : b,
        ),
      }
    }
    case "moveRestStart": {
      // The rest-zone start doubles as the last stage's end divider, so dragging
      // it resizes that stage. Clamp between the last real boundary and the end.
      if (clip.restStart == null) return clip
      const min =
        (clip.boundaries.length
          ? clip.boundaries[clip.boundaries.length - 1].frame
          : clip.start) + 1
      const max = clip.end - 1
      if (max < min) return clip
      return { ...clip, restStart: clamp(edit.frame, min, max) }
    }
    case "removeRestZone":
      // The last stage reclaims the tail up to `end`; any hit parked in the zone
      // now falls inside that stage (a displaced/delayed hit) by its frame.
      return { ...clip, restStart: undefined }
    case "setBoundaryCue":
      return {
        ...clip,
        boundaries: clip.boundaries.map((b) =>
          b.id === edit.id ? { ...b, cue: edit.cue } : b,
        ),
      }
    case "setVariant": {
      if (edit.stageIndex < 0 || edit.stageIndex >= clip.stageRefs.length)
        return clip
      const variants = { ...clip.variants }
      variants[edit.stageIndex] = {
        ...variants[edit.stageIndex],
        [edit.track]: edit.target,
      }
      return { ...clip, variants }
    }
    case "clearVariant": {
      const pins = clip.variants?.[edit.stageIndex]
      if (!pins?.[edit.track]) return clip
      const nextPins = { ...pins }
      delete nextPins[edit.track]
      const variants = { ...clip.variants }
      if (Object.keys(nextPins).length === 0) delete variants[edit.stageIndex]
      else variants[edit.stageIndex] = nextPins
      return {
        ...clip,
        variants: Object.keys(variants).length ? variants : undefined,
      }
    }
    case "setAnimationSplit":
      return placeSplit(clip, edit.stageIndex, edit.frame, edit.cue)
    case "moveAnimationSplit": {
      const existing = clip.animationSplits?.[edit.stageIndex]
      if (!existing) return clip
      return placeSplit(clip, edit.stageIndex, edit.frame, existing.cue)
    }
    case "setAnimationSplitCue": {
      const existing = clip.animationSplits?.[edit.stageIndex]
      if (!existing) return clip
      return placeSplit(clip, edit.stageIndex, existing.frame, edit.cue)
    }
    case "clearAnimationSplit": {
      if (!clip.animationSplits?.[edit.stageIndex]) return clip
      const slots = clip.animationSplits.map((s, idx) =>
        idx === edit.stageIndex ? null : s,
      )
      return {
        ...clip,
        animationSplits: slots.some((s) => s != null) ? slots : undefined,
      }
    }
  }
}
