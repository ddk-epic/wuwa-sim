import type {
  DamageEntry,
  Footing,
  HealTarget,
  SkillType,
} from "#/types/character"
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

/**
 * A unit of work drained by the simulation worklist. Today the only kind is an
 * authored Timeline Entry; synthetic and trailing hits join as new kinds in a
 * later step (ADR-0028). Authored entries are a sequential FIFO — an entry's
 * landing frame is a running cursor computed *during* processing, not known up
 * front — so they are never frame-keyed.
 */
type WorkItem = { kind: "entry"; entry: TimelineEntry }

/** The running position of the simulation: the engine clock frame. */
interface SimCursor {
  frame: number
}

/**
 * A synthetic emit (emitHit/coordHit) awaiting resolution at its landing frame
 * (ADR-0028). Footing-blind and fire-and-forget — never tombstoned.
 */
interface PendingSynthetic {
  kind: "synthetic"
  frame: number
  emit: DeferredEmit
  /** The authored entry whose hit emitted this synthetic, for log attribution. */
  sourceEntryId: string
}

/**
 * A swap-stage trailing hit awaiting resolution at its `hitFrame` (ADR-0018,
 * relocated onto the unified queue in ADR-0028's endgame). Unlike synthetics it
 * is **tombstonable** (`valid`): a same-character cancel-capable re-entry marks
 * trailing hits with `hitFrame ≥ entryStart` invalid instead of resolving them.
 */
interface PendingTrailing {
  kind: "trailing"
  frame: number
  characterId: number
  valid: boolean
  bundle: TrailingHit
}

/**
 * A footing change for one character on the stream (ADR-0022 per-character
 * footing amendment): a launch/land **commit** (`resetIfOffField: false`) that
 * sets the owner's footing at its commit frame, or the **window-end reset**
 * (`resetIfOffField: true`) that returns the owner to `ground` on the
 * [[In-trailing]] → [[In-reserve]] transition — but only if it is still
 * off-field at that frame. Commits are tombstonable like trailing hits; resets
 * are cancelled when the owner re-enters.
 */
interface PendingFooting {
  kind: "footing"
  frame: number
  characterId: number
  valid: boolean
  exitFooting: "ground" | "air"
  resetIfOffField: boolean
}

/**
 * One member of the single frame-ordered event stream the walk drains lazily
 * (ADR-0028 endgame). Drained in nondecreasing `frame` order before every engine
 * advance, so the monotonic clock never overshoots a member's frame.
 */
type PendingEvent = PendingSynthetic | PendingTrailing | PendingFooting

/** Everything an entry/drain step needs, threaded through the worklist. */
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
  /**
   * The single frame-ordered pending-event stream: synthetics, trailing hits,
   * and footing commits/resets, all drained in nondecreasing frame order.
   */
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
  opts: { useWorklist?: boolean } = {},
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

  // α-oracle seam (ADR-0028): the worklist path drains authored entries in
  // FIFO order through the *same* per-entry step as the plain walk, so its log
  // is byte-identical. Synthetic/trailing emission moves onto it in later steps.
  if (opts.useWorklist) {
    drainWorklist(
      entries.map((entry): WorkItem => ({ kind: "entry", entry })),
      ctx,
    )
  } else {
    for (const entry of entries) processAuthoredEntry(entry, ctx)
  }

  // The stream's tail: any trailing hits / synthetics that never re-entered.
  // Parked footing commits with no re-entry are intentionally dropped (the owner
  // stayed off-field, so the launch/land never became team footing).
  drainPending(ctx, Infinity)

  return log
}

/**
 * Drain the worklist in order. The array iterator re-reads `length` each step,
 * so items a later step enqueues mid-drain are picked up in the same pass.
 */
function drainWorklist(queue: WorkItem[], ctx: SimContext): void {
  for (const item of queue) processWorkItem(item, ctx)
}

/**
 * Dispatch one work item by kind. Only authored entries exist today (ADR-0028
 * step 2); synthetic/trailing kinds reintroduce a `switch` here when added.
 */
function processWorkItem(item: WorkItem, ctx: SimContext): void {
  processAuthoredEntry(item.entry, ctx)
}

/** Process one authored Timeline Entry, advancing the cursor in place. */
function processAuthoredEntry(entry: TimelineEntry, ctx: SimContext): void {
  const { engine, slots, loadouts, cursor } = ctx
  const resolved = findStageByEntry(entry, slots, loadouts)
  const incomingSkillType = resolved?.skillType ?? "Basic Attack"
  // Decide this entry's collision with the same character's in-flight trailing
  // hits / parked footing *before* draining: a cancel-capable re-entry tombstones
  // them, so they must not resolve first (ADR-0018 drop, now a tombstone).
  const arrival = resolveArrival(
    ctx,
    entry.characterId,
    incomingSkillType,
    cursor.frame,
  )
  cursor.frame += arrival.padFrames
  // Now drain surviving members that land at/before this entry begins, so they
  // interleave into the log in frame order ahead of it (no-op when honor off and
  // nothing pending). A surviving footing commit fires here, setting this
  // character's footing before its stage reads it for Fall Frames.
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
    // The launch/land commit is a stream event at its commit frame, updating the
    // owner's own footing (it is In-trailing — off-field, footing still live).
    ctx.pending.push({
      kind: "footing",
      frame: part.pendingFooting.atFrame,
      characterId: entry.characterId,
      valid: true,
      exitFooting: part.pendingFooting.exitFooting,
      resetIfOffField: false,
    })
    // An airborne owner returns to ground when its Trailing Window passes without
    // a swap-back (In-trailing → In-reserve); the window ends at stageStart +
    // actionTime. A re-entry before then cancels this reset.
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
 * The same-character re-entry decision (ADR-0018, relocated onto the pending
 * stream). Reads the character's in-flight trailing hits and footing commit
 * (still on `ctx.pending`) and resolves the collision exactly as the dissolved
 * `TrailingWindow` did:
 *  - **no collision** (all land before this entry): nothing to do — surviving
 *    members drain ahead of the entry;
 *  - **cancel-capable collision**: *tombstone* trailing hits and the footing
 *    commit at/after the entry start (they never resolve — the launch never
 *    happened);
 *  - **non-cancel-capable collision**: pad to the latest pending frame so every
 *    trailing hit and the footing commit land.
 * The window-end footing reset is always cancelled here: the owner is back
 * On-field, so its footing is driven by play, not by a stale reset.
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
  // Re-entry within the Trailing Window (before window-end) keeps the carried
  // footing — cancel the reset. A re-entry at/after window-end lets the reset
  // fire first, so the character takes the field benched to ground.
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

  // Non-cancel-capable: pad past the latest pending same-character frame so every
  // trailing hit and the footing commit land.
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
 * nondecreasing frame order and appending each to the log at its frame. Chains
 * may enqueue further pending members, picked up in the same drain. Tombstoned
 * (invalidated) trailing hits are skipped.
 */
function drainPending(ctx: SimContext, uptoFrame: number): void {
  for (;;) {
    // Stable within a frame: synthetics keep emission order; a same-frame
    // trailing hit and synthetic keep their relative insertion order.
    ctx.pending.sort((a, b) => a.frame - b.frame)
    if (ctx.pending.length === 0 || ctx.pending[0].frame > uptoFrame) return
    const next = ctx.pending.shift() as PendingEvent
    if (next.kind === "trailing") {
      if (!next.valid) continue
      resolveTrailingBundle(next.bundle, ctx)
    } else if (next.kind === "footing") {
      if (!next.valid) continue
      // Commit (air/ground) or window-end reset (ground) — set the owner's
      // carried footing. A re-entry within the window cancels the reset in
      // `resolveArrival`; a re-entry past window-end lets it fire first (the
      // owner is benched to ground before it takes the field again).
      ctx.engine.footing.commitFor(next.characterId, next.exitFooting)
    } else {
      resolvePendingSynthetic(next, ctx)
    }
  }
}

/**
 * Advance the engine clock to `frame`, resolving any pending stream member at or
 * before it *first* (ADR-0028 endgame, item 1). The engine clock is monotonic —
 * `tickToFrame` only moves forward — so a pending member must be drained before
 * the clock ticks past its frame, or its snapshot would be taken at the overshot
 * frame instead. Every engine-advance the authored walk performs funnels through
 * here so nothing is overshot. Members at exactly `frame` resolve before the
 * advancing hit, preserving today's emission order (trigger-causality tie-break).
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
  // Mirror the authored-hit path: advance to the landing frame so the snapshot
  // and resource reads are frame-honest, then resolve + run the synthetic chain.
  // The drain loop has already resolved everything at an earlier frame, so a raw
  // tick here cannot overshoot another pending member.
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

  // Pre-drain to effectiveStart so a deferred synthetic landing before this
  // stage starts resolves (and snapshots) ahead of it — the clock must not
  // overshoot it (ADR-0028 endgame, item 1).
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
  // Flush this cast's immediate (offset-0) synthetics in place: they must log
  // before the action event and apply their resource gains before the action's
  // cumulativeEnergy snapshot, matching the eager path. The clock is already at
  // `frame`, so this drain only resolves the just-enqueued same-frame emits;
  // offset emits (landingFrame > frame) stay pending for a later drain.
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
 * so anything landing at/before it resolves (and snapshots) ahead of it
 * (ADR-0028). Used by the authored walk for immediate and fire-before-entry
 * hits. The drain itself calls {@link resolveTrailingBundle} directly to avoid
 * re-entering the pre-drain.
 */
function processHit(bundle: TrailingHit, ctx: SimContext): void {
  drainPending(ctx, bundle.hitFrame)
  resolveTrailingBundle(bundle, ctx)
}

/** Resolve a hit bundle at its `hitFrame` without pre-draining the stream. */
function resolveTrailingBundle(bundle: TrailingHit, ctx: SimContext): void {
  const { hit, hitIndex, entry, resolved, hitFrame } = bundle
  const { engine, log } = ctx
  const hitResolved = engine.resolveHit(entry.characterId, hitFrame)
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
