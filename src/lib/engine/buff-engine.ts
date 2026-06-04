import type {
  BuffDef,
  BuffInstance,
  CoordHitEffect,
  EmitHitEffect,
  HitContext,
  ResourceEffect,
  ResourceKind,
  ResourceState,
} from "#/types/buff"
import { GLOBAL_TARGET_ID } from "#/types/buff"
import type { SkillCategory, SkillType } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type {
  ActiveBuff,
  BuffEvent,
  HitEvent,
  SustainEvent,
} from "#/types/simulation-log"
import type { ScalarStatKey, StatTable } from "#/types/stat-table"
import { getCharacterById } from "../loadout/catalog"
import { resolveHealTargets } from "../heal-targets"
import {
  buffInstanceKey,
  buildSyntheticEvent,
  EmitHitDispatcher,
} from "./emit-hit-dispatcher"
import type {
  DeferredEmit,
  EmitHitHost,
  EmitHitInput,
} from "./emit-hit-dispatcher"
import { accrueForHit } from "./resource-accrual"
import type { Accrual } from "./resource-accrual"
import { bootstrapSlot } from "../engine-bootstrap"
import { ConditionEvaluator } from "./condition-evaluator"
import type { ConditionSubject, ConditionWorld } from "./condition-evaluator"
import { InstanceStore } from "./instance-store"
import type { Candidate, EngineEvent } from "./instance-store"
import { FootingModule } from "./footing"
import { OnFieldTracker } from "./on-field-tracker"
import { ResourceLedger } from "./resource-ledger"
import { accumulateStatEffects, matchesHit } from "./stat-table-builder"
import { TriggerIndex } from "./trigger-index"

export type { EngineEvent } from "./instance-store"

export type HitLandedEvent = Extract<EngineEvent, { kind: "hitLanded" }>
export type HealLandedEvent = Extract<EngineEvent, { kind: "healLanded" }>

export interface ResolvedHit {
  stats: StatTable
  activeBuffs: ActiveBuff[]
  passiveBuffs: ActiveBuff[]
  lifecycleEvents: BuffEvent[]
}

export interface HitDispatch {
  lifecycleEvents: BuffEvent[]
  deferredEmits: DeferredEmit[]
  postState: ResourceState
}

interface PhaseContext {
  event: EngineEvent
  candidates: readonly Candidate[]
  out: BuffEvent[]
  hitsOut: (HitEvent | SustainEvent)[]
  depth: number
}

interface PhaseHandler {
  readonly name: string
  run: (ctx: PhaseContext) => void
}

export interface BootstrapInput {
  slots: Slots
  loadouts: SlotLoadout[]
}

const EMIT_HIT_CHAIN_DEPTH_CAP = 8

/** Synthetic emit-hit events have no SkillCategory source; map from effect skillType. */
function skillTypeToCategory(skillType: SkillType | undefined): SkillCategory {
  return skillType ?? "Basic Attack"
}

function subjectAtTrigger(sourceCharacterId: number): ConditionSubject {
  return { sourceCharacterId, targetCharacterId: sourceCharacterId }
}

type PendingOutroBuff = {
  def: BuffDef
  sourceCharacterId: number
  triggerFrame: number
}

export class BuffEngine {
  private store = new InstanceStore()
  private triggerIndex = new TriggerIndex([])
  private resources = new ResourceLedger()
  private onField = new OnFieldTracker()
  readonly footing = new FootingModule()
  private cooldownLastFired = new Map<string, number>()
  private foldedBuffsMap = new Map<number, BuffDef[]>()
  private pendingOutroBuffs: PendingOutroBuff[] = []
  private evaluator = new ConditionEvaluator(this.buildConditionWorld())
  /** Guards against circular resolveStats calls from scaledByStat value expressions. */
  private resolvingStats = new Set<number>()
  private emitHitDispatcher = new EmitHitDispatcher({
    chainDepthCap: EMIT_HIT_CHAIN_DEPTH_CAP,
  })
  /** Deferred emits produced during the in-flight `onEvent` / resolve call. */
  private deferredEmits: DeferredEmit[] = []
  private emitHitHost: EmitHitHost = {
    activeBuffs: (id, hit) => this.activeBuffs(id, hit),
    passiveBuffs: (id) => this.passiveBuffs(id),
    resolveHealTargets: (target, sourceId) =>
      resolveHealTargets(target, sourceId, this.store.getPartyCharacterIds()),
  }

  /**
   * Trigger-driven phase pipeline (ADR-0006). Phase ordering is a value, not
   * inline control flow: changing order means editing this list. Within each
   * phase, candidates are already lex-sorted by `buffDef.id` upstream.
   */
  private readonly phases: ReadonlyArray<PhaseHandler> = [
    { name: "resource", run: (ctx) => this.runResourcePhase(ctx) },
    { name: "stat", run: (ctx) => this.runStatPhase(ctx) },
    { name: "emitHit", run: (ctx) => this.runEmitHitPhase(ctx) },
    { name: "coordHit", run: (ctx) => this.runCoordHitPhase(ctx) },
    {
      name: "consume",
      run: (ctx) => this.store.runConsumePhase(ctx.event, ctx.out),
    },
    { name: "removeBuffs", run: (ctx) => this.runRemoveBuffsPhase(ctx) },
  ]

  /** Test/inspection helper exposing the dispatch phase order as a value. */
  phaseOrder(): readonly string[] {
    return this.phases.map((p) => p.name)
  }

  private buildConditionWorld(): ConditionWorld {
    return {
      hasActiveBuff: (id, charId) => this.store.hasActiveOnTarget(id, charId),
      isOnField: (charId) => this.onField.isOnField(charId),
      getResourceValue: (charId, r) => this.resources.getResource(charId)[r],
      mutationVersions: () => ({
        store: this.store.mutationVersion(),
        resources: this.resources.mutationVersion(),
        onField: this.onField.mutationVersion(),
      }),
    }
  }

  private deferOutroBuff(
    def: BuffDef,
    sourceCharacterId: number,
    frame: number,
  ): void {
    this.pendingOutroBuffs.push({ def, sourceCharacterId, triggerFrame: frame })
  }

  private materializePending(
    swapInEvent: Extract<EngineEvent, { kind: "swapIn" }>,
    out: BuffEvent[],
  ): void {
    if (this.pendingOutroBuffs.length === 0) return
    const pending = this.pendingOutroBuffs
    this.pendingOutroBuffs = []
    pending.sort((a, b) =>
      a.def.id < b.def.id ? -1 : a.def.id > b.def.id ? 1 : 0,
    )
    for (const p of pending) {
      this.store.applyBuff(
        p.def,
        p.sourceCharacterId,
        swapInEvent.characterId,
        swapInEvent.frame,
        out,
      )
    }
  }

  private applyOrDefer(
    def: BuffDef,
    sourceCharacterId: number,
    frame: number,
    out: BuffEvent[],
  ): void {
    if (def.target?.kind === "nextOnField") {
      if (
        def.condition &&
        !this.evaluator.evaluateUncached(
          def.condition,
          subjectAtTrigger(sourceCharacterId),
        )
      ) {
        return
      }
      this.deferOutroBuff(def, sourceCharacterId, frame)
      return
    }
    if (def.target?.kind === "global") {
      this.store.applyBuff(def, sourceCharacterId, GLOBAL_TARGET_ID, frame, out)
      return
    }
    const targetIds = this.store.resolveTargetIds(def, sourceCharacterId)
    for (const targetId of targetIds) {
      this.store.applyBuff(def, sourceCharacterId, targetId, frame, out)
    }
  }

  bootstrap(input: BootstrapInput): { lifecycleEvents: BuffEvent[] } {
    this.store.clear()
    this.resources.clear()
    this.resources.clearCaps()
    this.onField.clear()
    this.footing.clear()
    this.cooldownLastFired.clear()
    this.emitHitDispatcher.reset()
    this.foldedBuffsMap.clear()
    this.pendingOutroBuffs = []

    const slots: number[] = []
    const allTriggerable: BuffDef[] = []
    for (let i = 0; i < input.slots.length; i++) {
      const charId = input.slots[i]
      slots.push(charId ?? -1)
      if (charId === null) continue
      const character = getCharacterById(charId)
      if (character?.forteCap !== undefined) {
        this.resources.registerCap(charId, "forte", character.forteCap)
      }
      const slot = bootstrapSlot(charId, input.loadouts[i] ?? null)
      if (!slot) continue
      this.store.setBaseStats(slot.charId, slot.baseStats)
      this.store.setTriggerable(slot.charId, slot.triggerable)
      allTriggerable.push(...slot.triggerable)
      for (const inst of slot.permanentInstances) {
        this.store.pushPermanentInstance(inst)
      }
      this.foldedBuffsMap.set(slot.charId, slot.foldedBuffs)
      this.resources.ensureState(slot.charId)
    }
    this.store.setSlots(slots)

    this.triggerIndex = new TriggerIndex(allTriggerable)
    return { lifecycleEvents: [] }
  }

  getResource(characterId: number): ResourceState {
    return this.resources.getResource(characterId)
  }

  advanceOffFieldClocks(frames: number): void {
    this.onField.advanceOffFieldClocks(frames)
  }

  computeSwapBack(characterId: number, arrivalFrame: number): number {
    return this.onField.computeSwapBack(characterId, arrivalFrame)
  }

  /**
   * Process a triggering event. Returns lifecycle events from any apply/refresh
   * plus the emit decisions taken this event (`deferredEmits`); the simulation
   * resolves each at its landing frame.
   */
  onEvent(event: EngineEvent): {
    lifecycleEvents: BuffEvent[]
    deferredEmits: DeferredEmit[]
  } {
    const lifecycleEvents: BuffEvent[] = []
    const syntheticEvents: (HitEvent | SustainEvent)[] = []
    this.deferredEmits = []

    // Implicit swap inference: an authored skillCast by a different character
    // than the current on-field implies swapOut(prev) → swapIn(next).
    if (event.kind === "skillCast") {
      const swap = this.onField.inferSwap(event.characterId)
      if (swap) {
        if (swap.prev !== null) {
          this.onField.recordSwapOut(swap.prev, event.frame)
          this.dispatchEvent(
            { kind: "swapOut", characterId: swap.prev, frame: event.frame },
            lifecycleEvents,
            syntheticEvents,
            0,
          )
        }
        this.onField.setCurrent(swap.next)
        this.onField.recordSwapIn(swap.next)
        this.dispatchEvent(
          { kind: "swapIn", characterId: swap.next, frame: event.frame },
          lifecycleEvents,
          syntheticEvents,
          0,
        )
      }
    }

    this.dispatchEvent(event, lifecycleEvents, syntheticEvents, 0)
    return {
      lifecycleEvents,
      deferredEmits: this.deferredEmits,
    }
  }

  private dispatchEvent(
    event: EngineEvent,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    // Resource phase (implicit): hit-driven and skill-cast-driven accumulation
    // happens before trigger matching so resourceCrossed triggers can chain.
    if (event.kind === "hitLanded") {
      for (const a of this.accrueHitGains(event)) {
        this.applyResourceDelta(
          a.characterId,
          a.resource,
          a.delta,
          event.frame,
          out,
          hitsOut,
          depth,
        )
      }
    }
    if (event.kind === "skillCast") {
      if (event.concerto) {
        this.applyResourceDelta(
          event.characterId,
          "concerto",
          event.concerto,
          event.frame,
          out,
          hitsOut,
          depth,
        )
      }
      if (event.skillCategory === "Resonance Liberation") {
        const cost = event.resonanceCost ?? 100
        const energy = this.getResource(event.characterId).energy
        if (energy < cost) {
          const character = getCharacterById(event.characterId)
          const name = character ? character.name : `id ${event.characterId}`
          console.warn(
            `[BuffEngine] Resonance Liberation cast by ${name} with insufficient energy (${energy} < ${cost})`,
          )
        }
        this.setResource(
          event.characterId,
          "energy",
          0,
          event.frame,
          out,
          hitsOut,
          depth,
        )
      }
    }

    if (event.kind === "swapOut") {
      this.store.expireOnSourceSwapOut(event.characterId, event.frame, out)
    }

    if (event.kind === "swapIn") {
      this.materializePending(event, out)
    }

    const rawCandidates = this.store.findCandidates(event)
    const candidates = rawCandidates.filter(({ def, sourceCharacterId }) => {
      if (def.cooldown) {
        const key = `${def.id}|${sourceCharacterId}`
        const last = this.cooldownLastFired.get(key)
        if (last !== undefined && event.frame - last < def.cooldown * 60)
          return false
      }
      // Reactions have no instance for lazy re-evaluation; evaluate condition
      // at candidate-selection time (ADR-0011).
      if (def.condition && def.duration == null) {
        return this.evaluator.evaluateUncached(
          def.condition,
          subjectAtTrigger(sourceCharacterId),
        )
      }
      return true
    })
    for (const { def, sourceCharacterId } of candidates) {
      if (def.cooldown)
        this.cooldownLastFired.set(
          `${def.id}|${sourceCharacterId}`,
          event.frame,
        )
    }
    const ctx: PhaseContext = { event, candidates, out, hitsOut, depth }
    for (const phase of this.phases) phase.run(ctx)
  }

  private runResourcePhase(ctx: PhaseContext): void {
    for (const { def, sourceCharacterId } of ctx.candidates) {
      for (const effect of def.effects) {
        if (effect.kind !== "resource") continue
        const targets = this.store.resolveTargetIds(def, sourceCharacterId)
        for (const targetId of targets) {
          this.applyResourceEffect(
            effect,
            sourceCharacterId,
            targetId,
            ctx.event.frame,
            ctx.out,
            ctx.hitsOut,
            ctx.depth,
          )
        }
      }
    }
  }

  private runStatPhase(ctx: PhaseContext): void {
    const deferred: { def: BuffDef; sourceCharacterId: number }[] = []
    for (const { def, sourceCharacterId } of ctx.candidates) {
      if (def.duration == null) continue
      if (def.duration.kind === "inherit") {
        deferred.push({ def, sourceCharacterId })
        continue
      }
      this.applyOrDefer(def, sourceCharacterId, ctx.event.frame, ctx.out)
    }
    for (const { def, sourceCharacterId } of deferred) {
      this.applyOrDefer(def, sourceCharacterId, ctx.event.frame, ctx.out)
    }
  }

  private runRemoveBuffsPhase(ctx: PhaseContext): void {
    for (const { def } of ctx.candidates) {
      for (const effect of def.effects) {
        if (effect.kind !== "removeBuffs") continue
        this.store.removeBuffsById(effect.ids, ctx.event.frame, ctx.out)
      }
    }
  }

  private runEmitHitPhase(ctx: PhaseContext): void {
    for (const { def, sourceCharacterId } of ctx.candidates) {
      for (let i = 0; i < def.effects.length; i++) {
        const effect = def.effects[i]
        if (effect.kind !== "emitHit") continue
        this.fireEmitHit(
          def,
          effect,
          i,
          sourceCharacterId,
          ctx.event.frame,
          ctx.out,
          ctx.hitsOut,
          ctx.depth,
        )
      }
    }
  }

  private fireEmitHit(
    def: BuffDef,
    effect: EmitHitEffect,
    effectIndex: number,
    sourceCharacterId: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    const input = {
      buffInstanceKey: buffInstanceKey(def.id, sourceCharacterId),
      def,
      effect,
      effectIndex,
      sourceCharacterId,
    }
    // The emit decision (ICD + chain cap) is taken now, at the trigger frame.
    if (!this.emitHitDispatcher.tryEmit(input, { frame, depth })) return

    // The emit lands `actionFrame` frames after its trigger; offset 0 lands at the
    // trigger frame.
    const landingFrame = frame + effect.damage.actionFrame
    // A top-level (depth 0) or offset emit defers onto the stream. Only an in-frame
    // chain emit (depth >= 1, offset 0) resolves inline below, keeping the chain's
    // DFS emission order within the frame.
    if (depth === 0 || landingFrame > frame) {
      this.deferredEmits.push({ input, landingFrame, depth })
      return
    }

    const hit = this.resolveSyntheticEmit(input, frame, out, hitsOut, depth)
    hitsOut.push(hit)
    this.fireEmitChain(
      effect,
      sourceCharacterId,
      def.id,
      frame,
      out,
      hitsOut,
      depth,
    )
  }

  /** Fire the synthetic hit's own `hitLanded`/`healLanded` so source-synthetic buffs chain. */
  private fireEmitChain(
    effect: EmitHitEffect,
    sourceCharacterId: number,
    sourceBuffId: string,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    if (effect.damage.dmgType === "Heal") {
      this.dispatchEvent(
        {
          kind: "healLanded",
          characterId: sourceCharacterId,
          skillCategory: skillTypeToCategory(effect.skillType),
          frame,
        },
        out,
        hitsOut,
        depth + 1,
      )
    } else {
      // Chain: each synthetic hit fires its own hitLanded event subject to
      // per-instance ICDs. Energy/concerto already applied above; pass 0 so
      // the recursive dispatch's resource phase does not double-count.
      this.dispatchEvent(
        {
          kind: "hitLanded",
          characterId: sourceCharacterId,
          skillCategory: skillTypeToCategory(effect.skillType),
          dmgType: effect.damage.dmgType,
          synthetic: true,
          sourceBuffId,
          frame,
        },
        out,
        hitsOut,
        depth + 1,
      )
    }
  }

  /**
   * Resolve a deferred emit at its landing frame. The caller must have advanced
   * engine state to `d.landingFrame` first so the snapshot and resource reads are
   * frame-honest. Returns the synthetic event plus any lifecycle/synthetic/deferred
   * output its chain produced.
   */
  resolveDeferredEmit(d: DeferredEmit): {
    event: HitEvent | SustainEvent
    lifecycleEvents: BuffEvent[]
    syntheticEvents: (HitEvent | SustainEvent)[]
    deferredEmits: DeferredEmit[]
  } {
    const lifecycleEvents: BuffEvent[] = []
    const syntheticEvents: (HitEvent | SustainEvent)[] = []
    this.deferredEmits = []
    const event = this.resolveSyntheticEmit(
      d.input,
      d.landingFrame,
      lifecycleEvents,
      syntheticEvents,
      d.depth,
    )
    // A coord emit never re-enters the trigger matcher (coordHit→coord is
    // structurally impossible); only an emitHit fires its own hitLanded chain.
    if (d.input.effect.kind !== "coordHit") {
      this.fireEmitChain(
        d.input.effect,
        d.input.sourceCharacterId,
        d.input.def.id,
        d.landingFrame,
        lifecycleEvents,
        syntheticEvents,
        d.depth,
      )
    }
    return {
      event,
      lifecycleEvents,
      syntheticEvents,
      deferredEmits: this.deferredEmits,
    }
  }

  private runCoordHitPhase(ctx: PhaseContext): void {
    for (const { def, sourceCharacterId } of ctx.candidates) {
      for (let i = 0; i < def.effects.length; i++) {
        const effect = def.effects[i]
        if (effect.kind !== "coordHit") continue
        this.fireCoordHit(
          def,
          effect,
          i,
          sourceCharacterId,
          ctx.event.frame,
          ctx.out,
          ctx.hitsOut,
          ctx.depth,
        )
      }
    }
  }

  private fireCoordHit(
    def: BuffDef,
    effect: CoordHitEffect,
    effectIndex: number,
    sourceCharacterId: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    const input = {
      buffInstanceKey: buffInstanceKey(def.id, sourceCharacterId),
      def,
      effect,
      effectIndex,
      sourceCharacterId,
    }
    if (depth === 0) {
      // A top-level coord emit defers onto the stream like emitHit. coordHit carries
      // no landing offset and never chains, so it lands at the trigger frame.
      if (!this.emitHitDispatcher.tryEmit(input, { frame, depth })) return
      this.deferredEmits.push({ input, landingFrame: frame, depth })
      return
    }
    // The emit decision (ICD + chain cap) stays in the dispatcher; the engine
    // owns the accrual + snapshot via resolveSyntheticEmit.
    if (!this.emitHitDispatcher.tryEmit(input, { frame, depth })) return
    const hit = this.resolveSyntheticEmit(input, frame, out, hitsOut, depth)
    hitsOut.push(hit)
    // Bypass: coord events are NOT re-entered into the trigger matcher.
    // No dispatchEvent call here — coordHit→coord chain is structurally impossible.
  }

  /**
   * Authored-hit accrual: the ordered energy/share/concerto/forte deltas a
   * landed hit grants. ER/FR is read hit-agnostically (no hit context) once,
   * only when an energy or forte gain actually needs it. The pure rule lives in
   * {@link accrueForHit}; this only supplies engine state.
   */
  private accrueHitGains(event: HitLandedEvent): Accrual[] {
    if (!event.energy && !event.concerto && !event.forte) return []
    const needsStats = !!event.energy || !!event.forte
    const stats = needsStats ? this.resolveStats(event.characterId) : null
    return accrueForHit(
      {
        energy: event.energy,
        concerto: event.concerto,
        forte: event.forte,
        synthetic: event.synthetic,
      },
      {
        id: event.characterId,
        er: stats?.energyRechargePct ?? 0,
        fr: stats?.forteRechargePct ?? 0,
      },
      this.store.getPartyCharacterIds(),
    )
  }

  /**
   * Resolve an already-decided synthetic emit into its event: the engine owns
   * the accrual now (the dispatcher only decides + builds the snapshot). Stats
   * are resolved hit-scoped for the damage snapshot, then the hit-agnostic
   * ER/FR feeds {@link accrueForHit}; deltas are applied before `post` is read
   * so the snapshot's cumulative totals reflect this synthetic's own gains.
   */
  private resolveSyntheticEmit(
    input: EmitHitInput,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): HitEvent | SustainEvent {
    const character = getCharacterById(input.sourceCharacterId)
    const hitCtx: HitContext = {
      sourceBuffId: input.def.id,
      skillType: input.effect.skillType ?? input.effect.damage.type,
      element: input.effect.element ?? character?.element,
    }
    // Hit-scoped table for the damage snapshot — taken before accrual deltas.
    const stats = this.resolveStats(input.sourceCharacterId, hitCtx)
    // ER/FR is hit-agnostic by contract: read without hit context (#321).
    const actorStats = this.resolveStats(input.sourceCharacterId)
    const accruals = accrueForHit(
      {
        energy: input.effect.damage.energy,
        concerto: input.effect.damage.concerto,
        synthetic: true,
      },
      {
        id: input.sourceCharacterId,
        er: actorStats.energyRechargePct,
        fr: actorStats.forteRechargePct,
      },
      this.store.getPartyCharacterIds(),
    )
    for (const a of accruals) {
      this.applyResourceDelta(
        a.characterId,
        a.resource,
        a.delta,
        frame,
        out,
        hitsOut,
        depth,
      )
    }
    const post = this.getResource(input.sourceCharacterId)
    return buildSyntheticEvent(
      input,
      frame,
      stats,
      post,
      this.emitHitHost,
      hitCtx,
    )
  }

  private applyResourceDelta(
    characterId: number,
    resource: ResourceKind,
    delta: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    const { before, after } = this.resources.applyDelta(
      characterId,
      resource,
      delta,
    )
    this.fireResourceCrossed(
      characterId,
      resource,
      before,
      after,
      frame,
      out,
      hitsOut,
      depth,
    )
  }

  private setResource(
    characterId: number,
    resource: ResourceKind,
    value: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    const { before, after } = this.resources.setValue(
      characterId,
      resource,
      value,
    )
    this.fireResourceCrossed(
      characterId,
      resource,
      before,
      after,
      frame,
      out,
      hitsOut,
      depth,
    )
  }

  private fireResourceCrossed(
    characterId: number,
    resource: ResourceKind,
    before: number,
    after: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    if (before === after) return
    const direction: "up" | "down" = after > before ? "up" : "down"
    const thresholds = this.triggerIndex.crossedThresholds(
      resource,
      direction,
      before,
      after,
    )
    if (thresholds.length === 0) return
    thresholds.sort((a, b) => (direction === "up" ? a - b : b - a))
    for (const threshold of thresholds) {
      this.dispatchEvent(
        {
          kind: "resourceCrossed",
          characterId,
          resource,
          threshold,
          direction,
          frame,
        },
        out,
        hitsOut,
        depth,
      )
    }
  }

  private applyResourceEffect(
    effect: ResourceEffect,
    sourceCharacterId: number,
    targetCharacterId: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    if (effect.value.kind !== "const") return
    const v = effect.value.v
    const subjectId =
      effect.target === "source"
        ? sourceCharacterId
        : effect.target === "self"
          ? sourceCharacterId
          : targetCharacterId
    const state = this.resources.getResource(subjectId)
    const before = state[effect.resource]
    let after = before
    if (effect.op === "add") after = before + v
    else if (effect.op === "sub") after = before - v
    else after = v
    if (effect.op === "set") {
      this.setResource(
        subjectId,
        effect.resource,
        after,
        frame,
        out,
        hitsOut,
        depth,
      )
    } else {
      this.applyResourceDelta(
        subjectId,
        effect.resource,
        after - before,
        frame,
        out,
        hitsOut,
        depth,
      )
    }
  }

  /** Advance internal clock to `frame`; expire instances whose endTime <= frame. */
  tickToFrame(frame: number): { lifecycleEvents: BuffEvent[] } {
    return this.store.tickToFrame(frame)
  }

  /**
   * The single membership gate behind both `resolveStats` and `activeBuffs`: a
   * buff instance "contributes" to a hit iff it passes the Hit Filter (checked
   * first, short-circuiting the condition evaluator) and its condition holds.
   *
   * Hit Filter: a non-`appliesToHits` buff always passes; an `appliesToHits`
   * buff passes only when a matching `hit` is supplied. This makes "listed =
   * contributed" structural — one predicate instead of two hand-copied folds.
   */
  private activeContributions(
    characterId: number,
    hit?: HitContext,
  ): BuffInstance[] {
    return this.store.getActiveTargeting(characterId).filter((inst) => {
      if (inst.def.appliesToHits) {
        if (!hit || !matchesHit(inst.def.appliesToHits, hit)) return false
      }
      return (
        !inst.def.condition ||
        this.evaluator.evaluateCached(inst.def.condition, inst, characterId)
      )
    })
  }

  resolveStats(characterId: number, hit?: HitContext): StatTable {
    if (this.resolvingStats.has(characterId)) {
      return this.store.cloneBaseStats(characterId)
    }
    this.resolvingStats.add(characterId)
    try {
      const base = this.store.cloneBaseStats(characterId)
      const getCharStat = (cid: number, stat: ScalarStatKey): number => {
        return this.resolveStats(cid)[stat]
      }
      // One pass over the gated instances; `accumulateStatEffects` only does
      // `+=`, so folding hit-agnostic and hit-scoped buffs together yields the
      // same total as the two old passes.
      for (const inst of this.activeContributions(characterId, hit)) {
        accumulateStatEffects(
          base,
          { def: inst.def, stacks: inst.stacks, snapshots: inst.snapshots },
          getCharStat,
        )
      }
      return base
    } finally {
      this.resolvingStats.delete(characterId)
    }
  }

  /** Test/inspection helper. */
  getOnFieldCharacterId(): number | null {
    return this.onField.current()
  }

  /** Sorted ids of buff instances currently active on `characterId`. */
  activeBuffIds(characterId: number): string[] {
    return this.store.activeBuffIds(characterId)
  }

  /** Sorted active buff entries (id, name, stacks, sourceCharacterId) for `characterId`. Instances whose condition evaluates to false are excluded. When `hit` is provided, `appliesToHits` buffs that do not match the hit are also excluded. */
  activeBuffs(characterId: number, hit?: HitContext): ActiveBuff[] {
    return this.activeContributions(characterId, hit)
      .map((inst) => ({
        id: inst.def.id,
        name: inst.def.name,
        stacks: inst.stacks,
        sourceCharacterId: inst.sourceCharacterId,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }

  /** Passive buffs folded into baseStats at bootstrap for `characterId`, as ActiveBuff entries. */
  passiveBuffs(characterId: number): ActiveBuff[] {
    return (this.foldedBuffsMap.get(characterId) ?? []).map((def) => ({
      id: def.id,
      name: def.name,
      stacks: 1,
    }))
  }

  /**
   * Deep seam: advance to `frame`, resolve the actor's stat table, and snapshot
   * the active buffs — the inputs every per-hit damage computation needs.
   */
  resolveHit(
    actingCharacterId: number,
    frame: number,
    hit?: HitContext,
  ): ResolvedHit {
    const { lifecycleEvents } = this.tickToFrame(frame)
    const stats = this.resolveStats(actingCharacterId, hit)
    const activeBuffs = this.activeBuffs(actingCharacterId, hit)
    const passiveBuffs = this.passiveBuffs(actingCharacterId)
    return { stats, activeBuffs, passiveBuffs, lifecycleEvents }
  }

  /**
   * Deep seam: dispatch a hitLanded event and bundle the round-trip — lifecycle
   * events, synthetic hits, and the post-hit Resource State for the actor.
   */
  recordHit(event: HitLandedEvent): HitDispatch {
    const { lifecycleEvents, deferredEmits } = this.onEvent(event)
    const postState = this.getResource(event.characterId)
    return { lifecycleEvents, deferredEmits, postState }
  }

  recordHeal(event: HealLandedEvent): HitDispatch {
    const { lifecycleEvents, deferredEmits } = this.onEvent(event)
    const postState = this.getResource(event.characterId)
    return { lifecycleEvents, deferredEmits, postState }
  }
}

/** @internal Bridge for test-only inspection — not part of the public API. */
export interface BuffEngineInternals {
  pendingOutroBuffs: unknown[]
}
