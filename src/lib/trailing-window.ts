import type { DamageEntry, SkillType, VariantKind } from "#/types/character"
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

export type TrailingWindowState = ReadonlyMap<number, readonly TrailingHit[]>

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
} {
  const charHits = state.get(incoming.characterId)
  if (!charHits || charHits.length === 0) {
    return { fireBeforeEntry: [], padFrames: 0, stateAfter: state }
  }

  const newState = new Map(state)
  newState.delete(incoming.characterId)

  const hasCollision = charHits.some((p) => p.hitFrame >= incoming.frame)
  if (!hasCollision) {
    return { fireBeforeEntry: charHits, padFrames: 0, stateAfter: newState }
  }

  if (CANCEL_CAPABLE.has(incoming.skillType)) {
    const fireBeforeEntry = charHits.filter((p) => p.hitFrame < incoming.frame)
    return { fireBeforeEntry, padFrames: 0, stateAfter: newState }
  }

  const lastHit = charHits[charHits.length - 1]
  const padFrames = lastHit.hitFrame - incoming.frame
  return { fireBeforeEntry: charHits, padFrames, stateAfter: newState }
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

  if (trailing.length === 0) {
    return { immediate, stateAfter: state }
  }

  const newState = new Map(state)
  newState.set(ctx.entry.characterId, trailing)
  return { immediate, stateAfter: newState }
}

export function drainAll(state: TrailingWindowState): readonly TrailingHit[] {
  const result: TrailingHit[] = []
  for (const hits of state.values()) {
    result.push(...hits)
  }
  return result
}
