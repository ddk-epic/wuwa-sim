import type {
  DamageEntry,
  Footing,
  HealTarget,
  SkillType,
} from "#/types/character"
import type { HitContext } from "#/types/buff"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type {
  ActionEvent,
  BuffEvent,
  HitEvent,
  SimulationLogEntry,
  SustainEvent,
} from "#/types/simulation-log"
import type { TimelineEntry } from "#/types/timeline"
import { computeDamage } from "./damage/compute-damage"
import { computeHealing } from "./damage/compute-healing"
import { BuffEngine } from "./engine/buff-engine"
import type { ResolvedHit } from "./engine/buff-engine"
import type { DeferredEmit } from "./engine/emit-hit-dispatcher"
import { findStageByEntry, resolveStageExecution } from "./stage"
import type { ResolvedStage } from "./stage"
import { isCancelCapable, partitionStage } from "./trailing-window"
import type { TrailingHit } from "./trailing-window"

/** The running position of the simulation: the engine clock frame. */
interface SimCursor {
  frame: number
}

/** A synthetic emit (emitHit/coordHit) awaiting resolution at its landing frame. */
interface PendingSynthetic {
  kind: "synthetic"
  frame: number
  emit: DeferredEmit
  /** The authored entry whose hit emitted this synthetic, for log attribution. */
  sourceEntryId: string
}

/**
 * A swap-stage trailing hit awaiting resolution at its `hitFrame`. A
 * same-character cancel-capable re-entry sets `valid: false` on trailing hits
 * with `hitFrame ≥ entryStart`, and the drain skips them instead of resolving.
 */
interface PendingTrailing {
  kind: "trailing"
  frame: number
  characterId: number
  valid: boolean
  bundle: TrailingHit
}

/**
 * A footing change for one character on the stream: a launch/land commit
 * (`resetIfOffField: false`) that sets the owner's footing at its commit frame,
 * or a window-end reset (`resetIfOffField: true`) that returns the owner to
 * `ground` if still off-field at that frame. A cancelling re-entry sets
 * `valid: false`, and the drain skips it.
 */
interface PendingFooting {
  kind: "footing"
  frame: number
  characterId: number
  valid: boolean
  exitFooting: "ground" | "air"
  resetIfOffField: boolean
}

/** One member of the frame-ordered event stream, drained in nondecreasing frame order. */
type PendingEvent = PendingSynthetic | PendingTrailing | PendingFooting

/** Everything an entry/drain step needs. */
interface SimContext {
  engine: BuffEngine
  log: SimulationLogEntry[]
  slots: Slots
  loadouts: SlotLoadout[]
  reactionDelay: number
  swapFrames: number
  variantFloor: number
  fallFrames: number
  cursor: SimCursor
  /** The frame-ordered pending-event stream: synthetics, trailing hits, footing commits/resets. */
  pending: PendingEvent[]
}

export function runSimulation(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
  reactionDelay: number = 9,
  swapFrames: number = 6,
  variantFloor: number = 0,
  fallFrames: number = 21,
): SimulationLogEntry[] {
  const log: SimulationLogEntry[] = []
  const engine = new BuffEngine()
  engine.bootstrap({ slots, loadouts })

  const ctx: SimContext = {
    engine,
    log,
    slots,
    loadouts,
    reactionDelay,
    swapFrames,
    variantFloor,
    fallFrames,
    cursor: { frame: 0 },
    pending: [],
  }

  for (const entry of entries) processAuthoredEntry(entry, ctx)

  // Drain the stream's tail: trailing hits / synthetics that never re-entered.
  // Parked footing commits with no re-entry are dropped.
  drainPending(ctx, Infinity)

  return log
}

/** Process one authored Timeline Entry, advancing the cursor in place. */
function processAuthoredEntry(entry: TimelineEntry, ctx: SimContext): void {
  const { engine, slots, loadouts, cursor } = ctx
  const resolved = findStageByEntry(entry, slots, loadouts)
  const incomingSkillType = resolved?.skillType ?? "Basic Attack"
  // Resolve this entry's collision with the same character's in-flight trailing
  // hits / parked footing before draining: a cancel-capable re-entry invalidates them.
  const arrival = resolveArrival(
    ctx,
    entry.characterId,
    incomingSkillType,
    cursor.frame,
  )
  cursor.frame += arrival.padFrames
  // Drain surviving members landing at/before this entry begins so they interleave
  // ahead of it in frame order. A surviving footing commit sets this character's
  // footing before its stage reads it for Fall Frames.
  drainPending(ctx, cursor.frame)
  const animFrames = resolved?.stage.animationFrames ?? 0
  if (animFrames > 0) engine.advanceOffFieldClocks(animFrames)
  const swapBack = engine.computeSwapBack(entry.characterId, cursor.frame)

  if (!resolved) return

  const { allHits, stageDuration, stageStartFrame, nextFrame } = processEntry(
    entry,
    cursor.frame,
    resolved,
    ctx,
    arrival.padFrames,
    swapBack,
  )
  engine.footing.applyStageFooting(resolved.stage.footing, stageDuration)
  const part = partitionStage({
    entry,
    resolved,
    stageStartFrame,
    hits: allHits,
    variantKind: entry.variantKind,
    stageDuration,
  })
  for (const t of part.trailing) {
    ctx.pending.push({
      kind: "trailing",
      frame: t.hitFrame,
      characterId: entry.characterId,
      valid: true,
      bundle: t,
    })
  }
  if (part.pendingFooting) {
    // The launch/land commit sets the owner's footing at its commit frame.
    ctx.pending.push({
      kind: "footing",
      frame: part.pendingFooting.atFrame,
      characterId: entry.characterId,
      valid: true,
      exitFooting: part.pendingFooting.exitFooting,
      resetIfOffField: false,
    })
    // An airborne owner returns to ground when its Trailing Window passes without a
    // swap-back; the window ends at stageStart + actionTime. A re-entry before then
    // cancels this reset.
    if (part.pendingFooting.exitFooting === "air") {
      ctx.pending.push({
        kind: "footing",
        frame: stageStartFrame + resolved.stage.actionTime,
        characterId: entry.characterId,
        valid: true,
        exitFooting: "ground",
        resetIfOffField: true,
      })
    }
  }
  for (const h of part.immediate) processHit(h, ctx)
  cursor.frame = nextFrame
}

/**
 * Resolve a same-character re-entry against its in-flight trailing hits and
 * footing commit on `ctx.pending`:
 *  - no collision (all land before this entry): nothing to do;
 *  - cancel-capable collision: invalidate trailing hits and the footing commit
 *    at/after the entry start so the drain skips them;
 *  - non-cancel-capable collision: pad to the latest pending frame so they land.
 * The window-end footing reset is cancelled here when the owner re-enters.
 */
function resolveArrival(
  ctx: SimContext,
  characterId: number,
  skillType: SkillType,
  frame: number,
): { padFrames: number } {
  const sameTrailing = ctx.pending.filter(
    (p): p is PendingTrailing =>
      p.kind === "trailing" && p.valid && p.characterId === characterId,
  )
  const sameFooting = ctx.pending.filter(
    (p): p is PendingFooting =>
      p.kind === "footing" && p.valid && p.characterId === characterId,
  )
  const commit = sameFooting.find((f) => !f.resetIfOffField)
  const reset = sameFooting.find((f) => f.resetIfOffField)
  // Re-entry before window-end keeps the carried footing — cancel the reset.
  // A re-entry at/after window-end lets the reset fire first (back to ground).
  if (reset && frame < reset.frame) reset.valid = false

  if (sameTrailing.length === 0 && !commit) return { padFrames: 0 }

  const hasHitCollision = sameTrailing.some((p) => p.frame >= frame)
  const hasFootingCollision = !!commit && commit.frame >= frame

  if (!hasHitCollision && !hasFootingCollision) return { padFrames: 0 }

  if (isCancelCapable(skillType)) {
    for (const p of sameTrailing) if (p.frame >= frame) p.valid = false
    if (commit && commit.frame >= frame) commit.valid = false
    return { padFrames: 0 }
  }

  // Pad past the latest pending same-character frame so every trailing hit and
  // the footing commit land.
  const lastHitFrame = sameTrailing.reduce(
    (m, p) => Math.max(m, p.frame),
    -Infinity,
  )
  const commitFrame = commit?.frame ?? -Infinity
  const latest = Math.max(lastHitFrame, commitFrame)
  return { padFrames: latest - frame }
}

/**
 * Drain the pending-event stream up to `uptoFrame`, resolving members in
 * nondecreasing frame order and logging each at its frame. Chains may enqueue
 * further members, picked up in the same drain. Invalidated trailing hits are skipped.
 */
function drainPending(ctx: SimContext, uptoFrame: number): void {
  for (;;) {
    // Stable within a frame: members keep their relative insertion order.
    ctx.pending.sort((a, b) => a.frame - b.frame)
    if (ctx.pending.length === 0 || ctx.pending[0].frame > uptoFrame) return
    const next = ctx.pending.shift() as PendingEvent
    if (next.kind === "trailing") {
      if (!next.valid) continue
      resolveTrailingBundle(next.bundle, ctx)
    } else if (next.kind === "footing") {
      if (!next.valid) continue
      // Commit or window-end reset — set the owner's carried footing.
      ctx.engine.footing.commitFor(next.characterId, next.exitFooting)
    } else {
      resolvePendingSynthetic(next, ctx)
    }
  }
}

/**
 * Advance the engine clock to `frame`, draining any pending stream member at or
 * before it first so the monotonic clock never snapshots past a member's frame.
 * Returns the tick's lifecycle events for the caller to log.
 */
function advanceTo(
  ctx: SimContext,
  frame: number,
): { lifecycleEvents: BuffEvent[] } {
  drainPending(ctx, frame)
  return ctx.engine.tickToFrame(frame)
}

/** Resolve a single deferred synthetic at its landing frame and log it. */
function resolvePendingSynthetic(sd: PendingSynthetic, ctx: SimContext): void {
  const { engine, log } = ctx
  // Advance to the landing frame for a frame-honest snapshot, then resolve and
  // run the synthetic chain.
  pushBuffEvents(log, engine.tickToFrame(sd.emit.landingFrame).lifecycleEvents)
  const r = engine.resolveDeferredEmit(sd.emit)
  r.event.sourceEntryId = sd.sourceEntryId
  log.push(r.event)
  pushBuffEvents(log, r.lifecycleEvents)
  for (const synth of r.syntheticEvents) {
    synth.sourceEntryId = sd.sourceEntryId
    log.push(synth)
  }
  for (const emit of r.deferredEmits)
    enqueueSynthetic(ctx, emit, sd.sourceEntryId)
}

/** Enqueue a synthetic emit onto the pending stream at its landing frame. */
function enqueueSynthetic(
  ctx: SimContext,
  emit: DeferredEmit,
  sourceEntryId: string,
): void {
  ctx.pending.push({
    kind: "synthetic",
    frame: emit.landingFrame,
    emit,
    sourceEntryId,
  })
}

function processEntry(
  entry: TimelineEntry,
  stageStartFrame: number,
  resolved: ResolvedStage,
  ctx: SimContext,
  padFrames: number = 0,
  swapBack: number = 0,
): {
  allHits: DamageEntry[]
  stageDuration: number
  stageStartFrame: number
  nextFrame: number
} {
  const { engine, log } = ctx
  const {
    advance: stageDuration,
    hits: allHits,
    react,
    floor,
  } = resolveStageExecution(
    resolved.stage,
    entry.variantKind,
    ctx.reactionDelay,
    ctx.swapFrames,
    ctx.variantFloor,
  )

  // The footing this entry's character takes the field on: its carried override
  // (a swap-back during its own Trailing Window enters airborne; a benched
  // character carries ground) or the inherited team footing (a fresh swap-in).
  const effectiveFooting = engine.footing.resolveEntry(entry.characterId)
  const fall = computeFall(
    effectiveFooting,
    resolved.stage.footing,
    ctx.fallFrames,
  )

  const effectiveStart = stageStartFrame + fall + swapBack

  // Pre-drain to effectiveStart so a deferred synthetic landing before this stage
  // starts resolves ahead of it.
  pushBuffEvents(log, advanceTo(ctx, effectiveStart).lifecycleEvents)

  if (resolved.skillType !== "Movement") {
    fireSkillCast(entry, resolved, ctx, effectiveStart)
  }

  const actionEvent = buildActionEvent(
    entry,
    resolved,
    engine,
    effectiveStart,
    react,
    floor,
    padFrames,
    fall,
    swapBack,
  )
  log.push(actionEvent)

  return {
    allHits,
    stageDuration,
    stageStartFrame: effectiveStart,
    nextFrame: effectiveStart + stageDuration,
  }
}

function fireSkillCast(
  entry: TimelineEntry,
  resolved: ResolvedStage,
  ctx: SimContext,
  frame: number,
): void {
  const { engine, log } = ctx
  const result = engine.onEvent({
    kind: "skillCast",
    characterId: entry.characterId,
    skillCategory: resolved.skillCategory,
    stageId: resolved.stageId,
    frame,
    concerto: resolved.concerto,
    resonanceCost: resolved.resonanceCost,
  })
  pushBuffEvents(log, result.lifecycleEvents)
  for (const emit of result.deferredEmits) enqueueSynthetic(ctx, emit, entry.id)
  // Flush this cast's immediate (offset-0) synthetics in place so they log before
  // the action event and apply their resource gains before its cumulativeEnergy
  // snapshot. Offset emits (landingFrame > frame) stay pending for a later drain.
  drainPending(ctx, frame)
}

function buildActionEvent(
  entry: TimelineEntry,
  resolved: ResolvedStage,
  engine: BuffEngine,
  frame: number,
  react: number = 0,
  floor: number = 0,
  padFrames: number = 0,
  fall: number = 0,
  swapBack: number = 0,
): ActionEvent {
  const actorState = engine.getResource(entry.characterId)
  const event: ActionEvent = {
    kind: "action",
    characterId: entry.characterId,
    skillType: resolved.damage[0]?.type ?? resolved.skillType,
    skillName: resolved.skillName,
    frame,
    cumulativeEnergy: actorState.energy,
    cumulativeConcerto: actorState.concerto,
    variantKind: entry.variantKind,
    sourceEntryId: entry.id,
  }
  if (react > 0 || floor > 0 || padFrames > 0 || fall > 0 || swapBack > 0) {
    event.delayBreakdown = { react, floor, pad: padFrames, fall, swapBack }
  }
  return event
}

function computeFall(
  currentFooting: "ground" | "air",
  stageFooting: Footing | undefined,
  fallFrames: number,
): number {
  if (currentFooting !== "air") return 0
  if (stageFooting !== "ground") return 0
  return fallFrames
}

/**
 * Resolve a hit bundle at its `hitFrame`, pre-draining the pending stream first
 * so anything landing at/before it resolves ahead of it.
 */
function processHit(bundle: TrailingHit, ctx: SimContext): void {
  drainPending(ctx, bundle.hitFrame)
  resolveTrailingBundle(bundle, ctx)
}

/** Resolve a hit bundle at its `hitFrame` without pre-draining the stream. */
function resolveTrailingBundle(bundle: TrailingHit, ctx: SimContext): void {
  const { hit, hitIndex, entry, resolved, hitFrame } = bundle
  const { engine, log } = ctx
  // Thread the same axes the hitLanded event carries so a `stageId`-scoped
  // `appliesToHits` bonus folds into this hit's snapshot and non-matching
  // hit-scoped buffs drop from its `activeBuffs`.
  const hitContext: HitContext = {
    stageId: `${resolved.stageId}.${hitIndex + 1}`,
    skillCategory: resolved.skillCategory,
    skillType: hit.type,
    element: resolved.element,
  }
  const hitResolved = engine.resolveHit(entry.characterId, hitFrame, hitContext)
  pushBuffEvents(log, hitResolved.lifecycleEvents)

  if (hit.dmgType === "Heal") {
    processHeal(hit, hitIndex, hitFrame, entry, resolved, hitResolved, ctx)
  } else {
    processDamageHit(hit, hitIndex, hitFrame, entry, resolved, hitResolved, ctx)
  }
}

function processHeal(
  hit: DamageEntry,
  hitIndex: number,
  hitFrame: number,
  entry: TimelineEntry,
  resolved: ResolvedStage,
  hitResolved: ResolvedHit,
  ctx: SimContext,
): void {
  const { engine, log, slots } = ctx
  const amount = computeHealing(
    { multiplier: hit.value, scalingStat: hit.scalingStat, flat: hit.flat },
    hitResolved.stats,
  )
  const dispatch = engine.recordHeal({
    kind: "healLanded",
    characterId: entry.characterId,
    skillCategory: resolved.skillCategory,
    frame: hitFrame,
    stageId: `${resolved.stageId}.${hitIndex + 1}`,
  })
  const sustainEvent: SustainEvent = {
    kind: "sustain",
    sub: "heal",
    characterId: entry.characterId,
    skillType: hit.type,
    skillName: `${resolved.skillName} [heal ${hitIndex + 1}]`,
    frame: hitFrame,
    cumulativeEnergy: dispatch.postState.energy,
    cumulativeConcerto: dispatch.postState.concerto,
    amount,
    targets: resolveHealTargets(hit.target ?? "self", entry.characterId, slots),
    scalingStat: hit.scalingStat,
    multiplier: hit.value,
    flat: hit.flat,
    statsSnapshot: { ...hitResolved.stats },
    activeBuffs: hitResolved.activeBuffs,
    passiveBuffs: hitResolved.passiveBuffs,
  }
  log.push(sustainEvent)
  pushBuffEvents(log, dispatch.lifecycleEvents)
  for (const emit of dispatch.deferredEmits)
    enqueueSynthetic(ctx, emit, entry.id)
}

function processDamageHit(
  hit: DamageEntry,
  hitIndex: number,
  hitFrame: number,
  entry: TimelineEntry,
  resolved: ResolvedStage,
  hitResolved: ResolvedHit,
  ctx: SimContext,
): void {
  const { engine, log } = ctx
  const dmg = computeDamage(
    {
      multiplier: hit.value,
      element: resolved.element,
      skillType: hit.type,
      dmgType: hit.dmgType,
      scalingStat: hit.scalingStat,
    },
    hitResolved.stats,
  )
  const dispatch = engine.recordHit({
    kind: "hitLanded",
    characterId: entry.characterId,
    skillCategory: resolved.skillCategory,
    dmgType: hit.dmgType,
    frame: hitFrame,
    stageId: `${resolved.stageId}.${hitIndex + 1}`,
    energy: hit.energy,
    concerto: hit.concerto,
    forte: hit.forte,
  })
  const hitEvent: HitEvent = {
    kind: "hit",
    characterId: entry.characterId,
    skillType: hit.type,
    skillName: `${resolved.skillName} [hit ${hitIndex + 1}]`,
    frame: hitFrame,
    cumulativeEnergy: dispatch.postState.energy,
    cumulativeConcerto: dispatch.postState.concerto,
    damage: dmg,
    element: resolved.element,
    dmgType: hit.dmgType,
    scalingStat: hit.scalingStat,
    multiplier: hit.value,
    statsSnapshot: { ...hitResolved.stats },
    activeBuffs: hitResolved.activeBuffs,
    passiveBuffs: hitResolved.passiveBuffs,
    sourceEntryId: entry.id,
  }
  log.push(hitEvent)
  pushBuffEvents(log, dispatch.lifecycleEvents)
  for (const emit of dispatch.deferredEmits)
    enqueueSynthetic(ctx, emit, entry.id)
}

function pushBuffEvents(log: SimulationLogEntry[], events: BuffEvent[]): void {
  for (const e of events) log.push(e)
}

function resolveHealTargets(
  target: HealTarget,
  healerId: number,
  slots: Slots,
): number[] {
  switch (target) {
    case "self":
    case "source":
      return [healerId]
    case "currentOnField":
      return [healerId]
    case "team":
      return slots.filter((id) => id !== null)
    case "nextOnField":
      return []
  }
}
