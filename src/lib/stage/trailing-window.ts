import type {
  DamageEntry,
  Footing,
  SkillType,
  VariantKind,
} from "#/types/character"
import type { TimelineEntry } from "#/types/timeline"
import type { ResolvedStage } from "./stage"

export interface TrailingHit {
  hit: DamageEntry
  hitIndex: number
  stageStartFrame: number
  entry: TimelineEntry
  resolved: ResolvedStage
  hitFrame: number
}

export interface TrailingEntry {
  hits: readonly TrailingHit[]
  pendingFooting?: { atFrame: number; exitFooting: "ground" | "air" }
}

export type TrailingWindowState = ReadonlyMap<number, TrailingEntry>

const CANCEL_CAPABLE = new Set<SkillType>([
  "Resonance Skill",
  "Resonance Liberation",
  "Intro Skill",
  "Outro Skill",
  "Echo Skill",
])

export function empty(): TrailingWindowState {
  return new Map()
}

export function onEntryArrival(
  state: TrailingWindowState,
  incoming: { characterId: number; skillType: SkillType; frame: number },
): {
  fireBeforeEntry: readonly TrailingHit[]
  padFrames: number
  stateAfter: TrailingWindowState
  pendingFootingToFire?: { exitFooting: "ground" | "air" }
} {
  const charEntry = state.get(incoming.characterId)
  if (!charEntry) {
    return { fireBeforeEntry: [], padFrames: 0, stateAfter: state }
  }

  const { hits: charHits, pendingFooting } = charEntry

  if (charHits.length === 0 && !pendingFooting) {
    return { fireBeforeEntry: [], padFrames: 0, stateAfter: state }
  }

  const newState = new Map(state)
  newState.delete(incoming.characterId)

  const hasHitCollision = charHits.some((p) => p.hitFrame >= incoming.frame)
  const hasFootingCollision =
    !!pendingFooting && pendingFooting.atFrame >= incoming.frame
  const hasCollision = hasHitCollision || hasFootingCollision

  if (!hasCollision) {
    const pendingFootingToFire = pendingFooting
      ? { exitFooting: pendingFooting.exitFooting }
      : undefined
    return {
      fireBeforeEntry: charHits,
      padFrames: 0,
      stateAfter: newState,
      pendingFootingToFire,
    }
  }

  if (CANCEL_CAPABLE.has(incoming.skillType)) {
    const fireBeforeEntry = charHits.filter((p) => p.hitFrame < incoming.frame)
    const pendingFootingToFire =
      pendingFooting && pendingFooting.atFrame < incoming.frame
        ? { exitFooting: pendingFooting.exitFooting }
        : undefined
    return {
      fireBeforeEntry,
      padFrames: 0,
      stateAfter: newState,
      pendingFootingToFire,
    }
  }

  const lastHitFrame =
    charHits.length > 0 ? charHits[charHits.length - 1].hitFrame : -Infinity
  const pendingFrame = pendingFooting?.atFrame ?? -Infinity
  const latestFrame = Math.max(lastHitFrame, pendingFrame)
  const padFrames = latestFrame - incoming.frame
  const pendingFootingToFire = pendingFooting
    ? { exitFooting: pendingFooting.exitFooting }
    : undefined
  return {
    fireBeforeEntry: charHits,
    padFrames,
    stateAfter: newState,
    pendingFootingToFire,
  }
}

export function scheduleStage(
  state: TrailingWindowState,
  ctx: {
    entry: TimelineEntry
    resolved: ResolvedStage
    stageStartFrame: number
    hits: readonly DamageEntry[]
    variantKind: VariantKind | undefined
    stageDuration: number
  },
): { immediate: readonly TrailingHit[]; stateAfter: TrailingWindowState } {
  const allBundles: TrailingHit[] = ctx.hits.map((h, i) => ({
    hit: h,
    hitIndex: i,
    stageStartFrame: ctx.stageStartFrame,
    entry: ctx.entry,
    resolved: ctx.resolved,
    hitFrame: ctx.stageStartFrame + h.actionFrame,
  }))

  const isSwap = ctx.variantKind === "swap"
  const immediate = isSwap
    ? allBundles.filter((b) => b.hit.actionFrame <= ctx.stageDuration)
    : allBundles
  const trailing = isSwap
    ? allBundles.filter((b) => b.hit.actionFrame > ctx.stageDuration)
    : []

  const pendingFooting = isSwap
    ? buildPendingFooting(
        ctx.resolved.stage?.footing,
        ctx.stageStartFrame,
        ctx.stageDuration,
      )
    : undefined

  if (trailing.length === 0 && !pendingFooting) {
    return { immediate, stateAfter: state }
  }

  const newState = new Map(state)
  newState.set(ctx.entry.characterId, { hits: trailing, pendingFooting })
  return { immediate, stateAfter: newState }
}

function buildPendingFooting(
  footing: Footing | undefined,
  stageStartFrame: number,
  stageDuration: number,
): { atFrame: number; exitFooting: "ground" | "air" } | undefined {
  if (!footing || typeof footing !== "object") return undefined
  if ("launch" in footing && footing.launch > stageDuration) {
    return { atFrame: stageStartFrame + footing.launch, exitFooting: "air" }
  }
  if ("land" in footing && footing.land > stageDuration) {
    return { atFrame: stageStartFrame + footing.land, exitFooting: "ground" }
  }
  return undefined
}

export function drainAll(state: TrailingWindowState): readonly TrailingHit[] {
  const result: TrailingHit[] = []
  for (const entry of state.values()) {
    result.push(...entry.hits)
  }
  return result
}
