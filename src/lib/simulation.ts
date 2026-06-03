import type { DamageEntry, Footing, HealTarget } from "#/types/character"
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
import { Schedule } from "./schedule"
import { isCancelCapable, partitionStage } from "./trailing-window"
import type { TrailingHit } from "./trailing-window"

/** The running position of the simulation: the engine clock frame. */
interface SimCursor {
  frame: number
}

/**
 * The payload of one frame-ordered stream member (the `Schedule`'s `T`): a
 * synthetic emit, a swap-stage trailing hit, or a footing commit/reset. Frame,
 * owner, and arrival class live on the `ScheduledWork` envelope; the `Schedule`
 * owns ordering, the watermark drain, and the drop/pad/reset collision policy,
 * so none of that is hand-written here.
 *
 *  - **synthetic** — an emitHit/coordHit; `ignore` class, never invalidated.
 *  - **trailing** — a swap-stage trailing hit; `residue` class (dropped on a
 *    cancel-capable re-entry, padded past on a non-cancel one).
 *  - **footing** — a launch/land commit (`residue`) or a window-end ground
 *    reset (`reset`, cancelled if the owner re-enters before its frame); on
 *    resolve it sets the owner's carried footing via `commitFor`.
 */
type Work =
  | {
      kind: "synthetic"
      emit: DeferredEmit
      /** The authored entry whose hit emitted this synthetic, for log attribution. */
      sourceEntryId: string
    }
  | { kind: "trailing"; bundle: TrailingHit }
  | { kind: "footing"; characterId: number; exitFooting: "ground" | "air" }

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
  /** The frame-ordered pending-work pool: synthetics, trailing hits, footing commits/resets. */
  schedule: Schedule<Work>
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
    schedule: new Schedule<Work>(),
  }

  for (const entry of entries) processAuthoredEntry(entry, ctx)

  // Drain the stream's tail: trailing hits / synthetics that never re-entered.
  // Parked footing commits with no re-entry are dropped.
  drainSchedule(ctx, Infinity)

  return log
}

/** Process one authored Timeline Entry, advancing the cursor in place. */
function processAuthoredEntry(entry: TimelineEntry, ctx: SimContext): void {
  const { engine, slots, loadouts, cursor } = ctx
  const resolved = findStageByEntry(entry, slots, loadouts)
  const incomingSkillType = resolved?.skillType ?? "Basic Attack"
  // Resolve this entry's collision with the same character's in-flight trailing
  // hits / parked footing before draining: a cancel-capable re-entry invalidates them.
  const arrival = ctx.schedule.resolveArrival(
    entry.characterId,
    isCancelCapable(incomingSkillType),
    cursor.frame,
  )
  cursor.frame += arrival.padFrames
  // Drain surviving members landing at/before this entry begins so they interleave
  // ahead of it in frame order. A surviving footing commit sets this character's
  // footing before its stage reads it for Fall Frames.
  drainSchedule(ctx, cursor.frame)
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
    // Trailing hits are residue: dropped on a cancel-capable re-entry, padded past on a non-cancel one.
    ctx.schedule.enqueue({
      frame: t.hitFrame,
      owner: entry.characterId,
      arrival: "residue",
      payload: { kind: "trailing", bundle: t },
    })
  }
  if (part.pendingFooting) {
    // The launch/land commit sets the owner's footing at its commit frame — residue,
    // obeying the same drop/pad as trailing hits.
    ctx.schedule.enqueue({
      frame: part.pendingFooting.atFrame,
      owner: entry.characterId,
      arrival: "residue",
      payload: {
        kind: "footing",
        characterId: entry.characterId,
        exitFooting: part.pendingFooting.exitFooting,
      },
    })
    // An airborne owner returns to ground when its Trailing Window passes without a
    // swap-back; the window ends at stageStart + actionTime. A re-entry before then
    // cancels this reset.
    if (part.pendingFooting.exitFooting === "air") {
      ctx.schedule.enqueue({
        frame: stageStartFrame + resolved.stage.actionTime,
        owner: entry.characterId,
        arrival: "reset",
        payload: {
          kind: "footing",
          characterId: entry.characterId,
          exitFooting: "ground",
        },
      })
    }
  }
  for (const h of part.immediate) processHit(h, ctx)
  cursor.frame = nextFrame
}

/**
 * Drain the pending-work pool up to `uptoFrame` through the `Schedule`,
 * resolving each surviving member in nondecreasing frame order via `resolveWork`
 * and logging it at its frame. Ordering, the watermark cutoff, within-frame
 * stability, and tombstone-skipping all live in the `Schedule`; chains a
 * `resolve` enqueues are picked up in the same drain.
 */
function drainSchedule(ctx: SimContext, uptoFrame: number): void {
  ctx.schedule.drainUpTo(uptoFrame, (work) => resolveWork(work, ctx))
}

/** Resolve one drained stream member by kind: synthetic / trailing hit / footing commit. */
function resolveWork(work: Work, ctx: SimContext): void {
  switch (work.kind) {
    case "trailing":
      resolveTrailingBundle(work.bundle, ctx)
      break
    case "footing":
      // Commit or window-end reset — set the owner's carried footing.
      ctx.engine.footing.commitFor(work.characterId, work.exitFooting)
      break
    case "synthetic":
      resolvePendingSynthetic(work, ctx)
      break
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
  drainSchedule(ctx, frame)
  return ctx.engine.tickToFrame(frame)
}

/** Resolve a single deferred synthetic at its landing frame and log it. */
function resolvePendingSynthetic(
  sd: Extract<Work, { kind: "synthetic" }>,
  ctx: SimContext,
): void {
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

/** Enqueue a synthetic emit onto the stream at its landing frame (ignore class — never invalidated). */
function enqueueSynthetic(
  ctx: SimContext,
  emit: DeferredEmit,
  sourceEntryId: string,
): void {
  ctx.schedule.enqueue({
    frame: emit.landingFrame,
    arrival: "ignore",
    payload: { kind: "synthetic", emit, sourceEntryId },
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
  drainSchedule(ctx, frame)
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
  drainSchedule(ctx, bundle.hitFrame)
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
