import type { DamageEntry, Footing } from "#/types/character"
import type { HitContext } from "#/types/buff"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type {
  ActionEvent,
  BuffEvent,
  DelayBreakdown,
  Diagnostic,
  HitEvent,
  SimulationLogEntry,
} from "#/types/simulation-log"
import type { TimelineEntry } from "#/types/timeline"
import { computeDamage } from "./damage/compute-damage"
import { computeHealing } from "./damage/compute-healing"
import { BuffEngine } from "./engine/buff-engine"
import type { PoolMaturation, ResolvedHit } from "./engine/buff-engine"
import type { DeferredEmit } from "./engine/emit-hit-dispatcher"
import { buildHitEvent, buildSustainEvent } from "./engine/log-event-builders"
import { findStageByEntry } from "./compile-character"
import { resolveStageExecution, stageEntryFooting } from "./stage"
import type { ResolvedStage } from "./stage"
import { resolveHealTargets } from "./heal-targets"
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
 *  - **maturation** — an Emit Pool member's auto-conversion timer; `maturation`
 *    class, never invalidated by an arrival. On resolve it converts the member
 *    into a deferred Synthetic Hit (a no-op if already converted early).
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
  | {
      kind: "maturation"
      characterId: number
      memberId: number
      frame: number
      /** The authored entry whose hit spawned this member, for log attribution. */
      sourceEntryId: string
    }

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
  /** Most-recent cast frame of each stage, keyed `${characterId}:${stageId}`. */
  priorCasts: Map<string, number>
}

/** Tuning knobs for a run; omitted fields fall back to {@link SIM_DEFAULTS}. */
export interface SimConfig {
  reactionDelay?: number
  swapFrames?: number
  variantFloor?: number
  fallFrames?: number
  startWithFullEnergy?: boolean
}

const SIM_DEFAULTS = {
  reactionDelay: 9,
  swapFrames: 6,
  variantFloor: 0,
  fallFrames: 21,
  startWithFullEnergy: false,
} as const

export function runSimulation(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
  config: SimConfig = {},
): SimulationLogEntry[] {
  const {
    reactionDelay,
    swapFrames,
    variantFloor,
    fallFrames,
    startWithFullEnergy,
  } = { ...SIM_DEFAULTS, ...config }

  const log: SimulationLogEntry[] = []
  const engine = new BuffEngine()
  engine.bootstrap({ slots, loadouts, startWithFullEnergy })

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
    priorCasts: new Map(),
  }

  for (const entry of entries) processAuthoredEntry(entry, ctx)

  // Drain the stream's tail: trailing hits / synthetics that never re-entered.
  // Parked footing commits with no re-entry are dropped.
  drainSchedule(ctx, Infinity)

  // Flush trailing lifecycle past the last authored action so the log carries
  // each buff's real expiry and any Negative Status ticks: advance to the latest
  // of the cursor, the live buff ends, and the status ends.
  const statuses = engine.getTarget().list()
  const lastEnd = Math.max(
    ctx.cursor.frame,
    engine.latestActiveEndFrame(),
    ...statuses.map((s) => s.endTime),
  )
  if (lastEnd > ctx.cursor.frame) {
    pushAdvance(log, engine.tickToFrame(lastEnd))
  }

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
  const swapBackWait = engine.computeSwapBack(entry.characterId, cursor.frame)

  if (!resolved) return

  // The two start-floors — swap-back cooldown and the windowed prior-stage gate —
  // are absolute-frame floors on the same start, so the wait is their max.
  const wait = Math.max(
    swapBackWait,
    computeGateWait(ctx, entry, resolved, cursor.frame),
  )

  const { allHits, stageDuration, stageStartFrame, nextFrame } = processEntry(
    entry,
    cursor.frame,
    resolved,
    ctx,
    arrival.padFrames,
    wait,
  )

  // A cutscene animation freezes the stage timer while real time elapses. Credited
  // only now, after the cast's swap has resolved: the caster is on-field and so
  // excluded (its own swap-back CD is not cleared by its own cast), while the
  // character it benched recovers the animation's worth of swap-back CD.
  const animFrames = resolved.stage.animationFrames ?? 0
  if (animFrames > 0) engine.advanceOffFieldClocks(animFrames)

  if (resolved.skillType === "Intro Skill") {
    // An Intro establishes its own footing regardless of what it entered on.
    engine.footing.enterIntro(resolved.stage.footing)
  } else {
    engine.footing.applyStageFooting(resolved.stage.footing, stageDuration)
  }
  const part = partitionStage({
    entry,
    resolved,
    stageStartFrame,
    hits: allHits,
    variantKind: entry.variantKind,
    stageDuration,
  })
  const isSwap = entry.variantKind === "swap"
  for (const t of part.trailing) {
    // Swap residue is droppable/padded on re-entry; non-swap background hits
    // (e.g. an Outro DoT) always land, so they enqueue as uncollidable `ignore`.
    ctx.schedule.enqueue({
      frame: t.hitFrame,
      ...(isSwap ? { owner: entry.characterId } : {}),
      arrival: isSwap ? "residue" : "ignore",
      payload: { kind: "trailing", bundle: t },
    })
  }
  for (const fc of part.footingChanges) {
    // A `commit` (launch/land flip) is residue, obeying the same drop/pad as
    // trailing hits; a `reset` is the window-end return to ground, cancelled by a
    // swap-back before stageStart + actionTime. Trailing-window plans the frames;
    // we only map its `kind` onto the Schedule's arrival vocabulary here.
    ctx.schedule.enqueue({
      frame: fc.atFrame,
      owner: entry.characterId,
      arrival: fc.kind === "commit" ? "residue" : "reset",
      payload: {
        kind: "footing",
        characterId: entry.characterId,
        exitFooting: fc.exitFooting,
      },
    })
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
    case "maturation":
      resolveMaturation(work, ctx)
      break
  }
}

/**
 * Convert an Emit Pool member at its maturation frame and park the resulting
 * Synthetic Hit onto the stream. Already-converted members resolve to a no-op
 * (empty deferredEmits). The clock is ticked frame-honest first, matching the
 * synthetic path.
 */
function resolveMaturation(
  work: Extract<Work, { kind: "maturation" }>,
  ctx: SimContext,
): void {
  const { engine, log } = ctx
  pushAdvance(log, engine.tickToFrame(work.frame))
  const r = engine.matureMember(work.characterId, work.memberId, work.frame)
  pushBuffEvents(log, r.lifecycleEvents)
  for (const synth of r.syntheticEvents) {
    synth.sourceEntryId = work.sourceEntryId
    log.push(synth)
  }
  for (const emit of r.deferredEmits)
    enqueueSynthetic(ctx, emit, work.sourceEntryId)
}

/**
 * Advance the engine clock to `frame`, draining any pending stream member at or
 * before it first so the monotonic clock never snapshots past a member's frame.
 * Returns the tick's lifecycle events for the caller to log.
 */
function advanceTo(
  ctx: SimContext,
  frame: number,
): { lifecycleEvents: BuffEvent[]; tickEvents: HitEvent[] } {
  drainSchedule(ctx, frame)
  return ctx.engine.tickToFrame(frame)
}

/** Log a clock-advance's expiry lifecycle events and its Negative Status ticks. */
function pushAdvance(
  log: SimulationLogEntry[],
  result: { lifecycleEvents: BuffEvent[]; tickEvents: HitEvent[] },
): void {
  for (const e of result.lifecycleEvents) log.push(e)
  for (const t of result.tickEvents) log.push(t)
}

/** Resolve a single deferred synthetic at its landing frame and log it. */
function resolvePendingSynthetic(
  sd: Extract<Work, { kind: "synthetic" }>,
  ctx: SimContext,
): void {
  const { engine, log } = ctx
  // Advance to the landing frame for a frame-honest snapshot, then resolve and
  // run the synthetic chain.
  pushAdvance(log, engine.tickToFrame(sd.emit.landingFrame))
  const r = engine.resolveDeferredEmit(sd.emit)
  r.event.sourceEntryId = sd.sourceEntryId
  log.push(r.event)
  drainDispatch(ctx, r, sd.sourceEntryId)
  for (const synth of r.syntheticEvents) {
    synth.sourceEntryId = sd.sourceEntryId
    log.push(synth)
  }
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

/** Park an Emit Pool maturation onto the stream at its conversion frame (maturation class). */
function enqueueMaturation(
  ctx: SimContext,
  m: PoolMaturation,
  sourceEntryId: string,
): void {
  ctx.schedule.enqueue({
    frame: m.maturationFrame,
    arrival: "maturation",
    payload: {
      kind: "maturation",
      characterId: m.characterId,
      memberId: m.memberId,
      frame: m.maturationFrame,
      sourceEntryId,
    },
  })
}

function processEntry(
  entry: TimelineEntry,
  cursorFrame: number,
  resolved: ResolvedStage,
  ctx: SimContext,
  trailingPad: number = 0,
  wait: number = 0,
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
  // Intro Skills ignore incoming footing — they enter on any footing, so never fall.
  const fall =
    resolved.skillType === "Intro Skill"
      ? 0
      : computeFall(effectiveFooting, resolved.stage.footing, ctx.fallFrames)

  const diagnostics = footingDiagnostics(effectiveFooting, resolved)

  const effectiveStart = cursorFrame + fall + wait

  // Record this entry's cast frame for later prerequisite lookups.
  ctx.priorCasts.set(`${entry.characterId}:${resolved.stageId}`, effectiveStart)

  // Pre-drain to effectiveStart so a deferred synthetic landing before this stage
  // starts resolves ahead of it.
  pushAdvance(log, advanceTo(ctx, effectiveStart))

  if (isCancelCapable(resolved.skillType)) {
    ctx.schedule.cancelResidue(entry.characterId, effectiveStart)
  }

  if (resolved.skillType !== "Movement") {
    diagnostics.push(...fireSkillCast(entry, resolved, ctx, effectiveStart))
  }

  const actionEvent = buildActionEvent(
    entry,
    resolved,
    engine,
    effectiveStart,
    { reaction: react, floor, trailing: trailingPad, fall },
    wait,
    diagnostics,
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
): Diagnostic[] {
  const { engine } = ctx
  const result = engine.onEvent({
    kind: "skillCast",
    characterId: entry.characterId,
    skillCategory: resolved.skillCategory,
    stageId: resolved.stageId,
    skill: resolved.skillKey,
    frame,
    concerto: resolved.concerto,
    resonanceCost: resolved.resonanceCost,
  })
  drainDispatch(ctx, result, entry.id)
  // Flush this cast's immediate (offset-0) synthetics in place so they log before
  // the action event and apply their resource gains before its cumulativeEnergy
  // snapshot. Offset emits (landingFrame > frame) stay pending for a later drain.
  drainSchedule(ctx, frame)
  return result.diagnostics
}

function buildActionEvent(
  entry: TimelineEntry,
  resolved: ResolvedStage,
  engine: BuffEngine,
  frame: number,
  pad: DelayBreakdown["pad"] = { reaction: 0, floor: 0, trailing: 0, fall: 0 },
  wait: number = 0,
  diagnostics: Diagnostic[] = [],
): ActionEvent {
  const actorState = engine.getResource(entry.characterId)
  const event: ActionEvent = {
    kind: "action",
    characterId: entry.characterId,
    skillType: resolved.damage[0]?.type ?? resolved.skillType,
    skillCategory: resolved.skillCategory,
    skillName: resolved.skillName,
    frame,
    cumulativeEnergy: actorState.energy,
    cumulativeConcerto: actorState.concerto,
    variantKind: entry.variantKind,
    sourceEntryId: entry.id,
  }
  if (actorState.pool > 0) event.pool = actorState.pool
  if (diagnostics.length > 0) event.diagnostics = diagnostics
  if (
    pad.reaction > 0 ||
    pad.floor > 0 ||
    pad.trailing > 0 ||
    pad.fall > 0 ||
    wait > 0
  ) {
    event.delayBreakdown = { pad, wait }
  }
  return event
}

/**
 * Frames the follow-up's start must wait to begin no earlier than
 * `anchorCastFrame + minDelay` (the windowed prior-stage gate). Returns 0 when
 * `minDelay` is absent or no anchor was recorded. The caller `max`-combines this
 * with the swap-back wait — both are absolute-frame floors on the same start.
 */
function computeGateWait(
  ctx: SimContext,
  entry: TimelineEntry,
  resolved: ResolvedStage,
  cursorFrame: number,
): number {
  const { requiresPriorStageId, minDelay } = resolved
  if (requiresPriorStageId === undefined || minDelay === undefined) return 0
  const anchor = ctx.priorCasts.get(
    `${entry.characterId}:${requiresPriorStageId}`,
  )
  if (anchor === undefined) return 0
  return Math.max(0, anchor + minDelay - cursorFrame)
}

/**
 * Warn when an entry begins grounded but its stage requires an airborne entry —
 * a sustained "air" stage or a { land } with nothing to land from. Impossible in
 * real play; the sim executes the stage anyway and reports the violation. The
 * reverse mismatch (airborne meeting a ground-entry stage) is legal — gravity
 * resolves it as Fall Frames, already visible in the delay breakdown. Intro
 * Skills ignore incoming footing entirely.
 */
function footingDiagnostics(
  currentFooting: "ground" | "air",
  resolved: ResolvedStage,
): Diagnostic[] {
  const footing = resolved.stage.footing
  if (
    resolved.skillType === "Intro Skill" ||
    currentFooting !== "ground" ||
    stageEntryFooting(footing) !== "air"
  ) {
    return []
  }
  const isLand = typeof footing === "object" && "land" in footing
  return [{ kind: "footingViolation", isLand }]
}

function computeFall(
  currentFooting: "ground" | "air",
  stageFooting: Footing | undefined,
  fallFrames: number,
): number {
  if (currentFooting !== "air") return 0
  // Fall when the next stage begins on the ground — an untagged stage, a sustained
  // "ground" stage, or a { launch } (which launches *from* the ground, so an airborne
  // entry falls first, then re-launches at the commit frame). { land } / "air" /
  // "either": no fall.
  if (stageEntryFooting(stageFooting) !== "ground") return 0
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
  // Thread the same axes the hitLanded event carries so a stage-scoped
  // `appliesToHits` bonus folds into this hit's snapshot and non-matching
  // hit-scoped buffs drop from its `activeBuffs`.
  const hitContext: HitContext = {
    stageId: resolved.stageId,
    skill: resolved.skillKey,
    hitIndex: hitIndex + 1,
    skillCategory: resolved.skillCategory,
    skillType: hit.type,
    element: resolved.element,
    labels: hit.labels,
  }
  const hitResolved = engine.resolveHit(entry.characterId, hitFrame, hitContext)
  pushAdvance(log, hitResolved)

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
    stageId: resolved.stageId,
    skill: resolved.skillKey,
    hitIndex: hitIndex + 1,
  })
  const sustainEvent = buildSustainEvent(
    {
      characterId: entry.characterId,
      frame: hitFrame,
      skillType: hit.type,
      scalingStat: hit.scalingStat,
      multiplier: hit.value,
      amount,
      flat: hit.flat,
      targets: resolveHealTargets(
        hit.target ?? "self",
        entry.characterId,
        slots.filter((id): id is number => id !== null),
      ),
      cumulativeEnergy: dispatch.postState.energy,
      cumulativeConcerto: dispatch.postState.concerto,
      statsSnapshot: hitResolved.stats,
      activeBuffs: hitResolved.activeBuffs,
      passiveBuffs: hitResolved.passiveBuffs,
    },
    {
      kind: "authored",
      skillName: `${resolved.skillName} [heal ${hitIndex + 1}]`,
      sourceEntryId: entry.id,
    },
  )
  log.push(sustainEvent)
  drainDispatch(ctx, dispatch, entry.id)
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
    engine.getTargetParams(),
  )
  const dispatch = engine.recordHit({
    kind: "hitLanded",
    characterId: entry.characterId,
    skillCategory: resolved.skillCategory,
    dmgType: hit.dmgType,
    frame: hitFrame,
    stageId: resolved.stageId,
    skill: resolved.skillKey,
    hitIndex: hitIndex + 1,
    energy: hit.energy,
    concerto: hit.concerto,
    forte: hit.forte,
    spawn: hit.spawn,
  })
  const hitEvent = buildHitEvent(
    {
      characterId: entry.characterId,
      frame: hitFrame,
      skillType: hit.type,
      element: resolved.element,
      dmgType: hit.dmgType,
      scalingStat: hit.scalingStat,
      multiplier: hit.value,
      damage: dmg,
      cumulativeEnergy: dispatch.postState.energy,
      cumulativeConcerto: dispatch.postState.concerto,
      statsSnapshot: hitResolved.stats,
      activeBuffs: hitResolved.activeBuffs,
      passiveBuffs: hitResolved.passiveBuffs,
    },
    {
      kind: "authored",
      skillName: `${resolved.skillName} [hit ${hitIndex + 1}]`,
      sourceEntryId: entry.id,
    },
  )
  log.push(hitEvent)
  drainDispatch(ctx, dispatch, entry.id)
}

function pushBuffEvents(log: SimulationLogEntry[], events: BuffEvent[]): void {
  for (const e of events) log.push(e)
}

/**
 * The dispatch sink shared by every event-emitting site: log the lifecycle
 * events, then re-enqueue each deferred emit onto the stream. Structural over
 * the result shape — `HitDispatch` and the `onEvent` / `resolveDeferredEmit`
 * results all carry both fields.
 */
function drainDispatch(
  ctx: SimContext,
  dispatch: {
    lifecycleEvents: BuffEvent[]
    deferredEmits: DeferredEmit[]
    poolMaturations?: PoolMaturation[]
  },
  sourceEntryId: string,
): void {
  pushBuffEvents(ctx.log, dispatch.lifecycleEvents)
  for (const emit of dispatch.deferredEmits)
    enqueueSynthetic(ctx, emit, sourceEntryId)
  for (const m of dispatch.poolMaturations ?? [])
    enqueueMaturation(ctx, m, sourceEntryId)
}
