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
import type {
  EmitPoolConfig,
  SkillCategory,
  SkillType,
} from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type {
  ActiveBuff,
  BuffEvent,
  Diagnostic,
  HitEvent,
  SustainEvent,
} from "#/types/simulation-log"
import type { ScalarStatKey, StatTable } from "#/types/stat-table"
import type { TargetParams, NegStatusInstance } from "#/types/target"
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
import { Target } from "./target"
import { negStatusDef } from "#/data/neg-statuses"
import type { NegStatusType } from "#/data/neg-status-types"
import { computeDamage } from "../damage/compute-damage"
import { buildHitEvent } from "./log-event-builders"
import { FootingModule } from "./footing"
import { OnFieldTracker } from "./on-field-tracker"
import { PoolStore } from "./pool-store"
import type { PoolMember } from "./pool-store"
import { ResourceLedger } from "./resource-ledger"
import {
  accumulateScaledStatEffects,
  accumulateStatEffects,
  matchesHit,
} from "./apply-stat-effects"
import { TriggerIndex } from "./trigger-index"

export type { EngineEvent } from "./instance-store"

export type HitLandedEvent = Extract<EngineEvent, { kind: "hitLanded" }>
export type HealLandedEvent = Extract<EngineEvent, { kind: "healLanded" }>

export interface ResolvedHit {
  stats: StatTable
  activeBuffs: ActiveBuff[]
  passiveBuffs: ActiveBuff[]
  lifecycleEvents: BuffEvent[]
  tickEvents: (HitEvent | SustainEvent)[]
}

/** A scheduled Emit Pool maturation the simulation parks on its Schedule. */
export interface PoolMaturation {
  characterId: number
  memberId: number
  maturationFrame: number
}

export interface HitDispatch {
  lifecycleEvents: BuffEvent[]
  deferredEmits: DeferredEmit[]
  poolMaturations: PoolMaturation[]
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
  /** Seed each occupied slot's energy to its own `maxEnergy` before sim start. */
  startWithFullEnergy?: boolean
  /** Seed each occupied slot's concerto to `CONCERTO_CAP` before sim start. */
  startWithFullConcerto?: boolean
}

const EMIT_HIT_CHAIN_DEPTH_CAP = 8

/**
 * Concerto's nominal cap and the Outro Skill cost. Accrual stays uncapped for
 * overcap-waste visibility; the cap is honored only inside `spend()`.
 */
export const CONCERTO_CAP = 100

/** Attribution carrier for the Synthetic Hit a converted Deferred Emit produces. */
const POOL_EMIT_DEF: BuffDef = {
  id: "emitPool",
  name: "Emit Pool",
  trigger: { event: "simStart" },
  effects: [],
}

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
  private target = new Target()
  private triggerIndex = new TriggerIndex([])
  private resources = new ResourceLedger()
  private pool = new PoolStore()
  private onField = new OnFieldTracker()
  readonly footing = new FootingModule()
  private cooldownLastFired = new Map<string, number>()
  private foldedBuffsMap = new Map<number, BuffDef[]>()
  private pendingOutroBuffs: PendingOutroBuff[] = []
  private evaluator = new ConditionEvaluator(this.buildConditionWorld())
  private emitHitDispatcher = new EmitHitDispatcher({
    chainDepthCap: EMIT_HIT_CHAIN_DEPTH_CAP,
  })
  /** Deferred emits produced during the in-flight `onEvent` / resolve call. */
  private deferredEmits: DeferredEmit[] = []
  /** Pool maturations spawned during the in-flight `onEvent` / resolve call. */
  private pendingMaturations: PoolMaturation[] = []
  /** Diagnostics produced during the in-flight `onEvent` call. */
  private diagnostics: Diagnostic[] = []
  private emitHitHost: EmitHitHost = {
    activeBuffs: (id, hit) => this.activeBuffs(id, hit),
    passiveBuffs: (id) => this.passiveBuffs(id),
    resolveHealTargets: (target, sourceId) =>
      resolveHealTargets(target, sourceId, this.store.getPartyCharacterIds()),
  }

  /**
   * Trigger-driven phase pipeline. Phase ordering is a value, not
   * inline control flow: changing order means editing this list. Within each
   * phase, candidates are already lex-sorted by `buffDef.id` upstream.
   */
  private readonly phases: ReadonlyArray<PhaseHandler> = [
    { name: "resource", run: (ctx) => this.runResourcePhase(ctx) },
    { name: "stat", run: (ctx) => this.runStatPhase(ctx) },
    { name: "negStatus", run: (ctx) => this.runNegStatusPhase(ctx) },
    { name: "emitHit", run: (ctx) => this.runEmitHitPhase(ctx) },
    { name: "coordHit", run: (ctx) => this.runCoordHitPhase(ctx) },
    { name: "convert", run: (ctx) => this.runConvertPhase(ctx) },
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
      hasAnyNegStatus: () => this.target.hasAnyStatus(),
      hasNegStatus: (t) => this.target.has(t),
      mutationVersions: () => ({
        store: this.store.mutationVersion(),
        resources: this.resources.mutationVersion(),
        onField: this.onField.mutationVersion(),
        target: this.target.mutationVersion(),
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
    this.target.reset()
    this.resources.clear()
    this.resources.clearCaps()
    this.pool.clear()
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
      if (!character) continue
      this.resources.registerCap(charId, "forte", character.forteCap)
      if (character.emitPool?.cap !== undefined) {
        this.resources.registerCap(charId, "pool", character.emitPool.cap)
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
      // Seed before sim-start so grants stack on top; energy is uncapped.
      if (input.startWithFullEnergy) {
        this.resources.applyDelta(charId, "energy", character.maxEnergy)
      }
      if (input.startWithFullConcerto) {
        this.resources.applyDelta(charId, "concerto", CONCERTO_CAP)
      }
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

  computeSwapBackPad(characterId: number, arrivalFrame: number): number {
    return this.onField.computeSwapBackPad(characterId, arrivalFrame)
  }

  /**
   * Process a triggering event. Returns lifecycle events from any apply/refresh,
   * the emit decisions taken this event (`deferredEmits`; the simulation
   * resolves each at its landing frame), and any Diagnostics the event raised
   * (cast-below-cost warnings — the cast proceeds, the caller logs the warning).
   */
  onEvent(event: EngineEvent): {
    lifecycleEvents: BuffEvent[]
    deferredEmits: DeferredEmit[]
    poolMaturations: PoolMaturation[]
    diagnostics: Diagnostic[]
  } {
    const lifecycleEvents: BuffEvent[] = []
    const syntheticEvents: (HitEvent | SustainEvent)[] = []
    this.deferredEmits = []
    this.pendingMaturations = []
    this.diagnostics = []

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
      poolMaturations: this.pendingMaturations,
      diagnostics: this.diagnostics,
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
      // Stamp the target's current statuses for trigger-time gating, so
      // matchesTrigger can stay pure (no world/target access).
      event.targetStatuses = this.target.list().map((i) => i.def.type)
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
      if (event.spawn) {
        this.spawnIntoPool(
          event.characterId,
          event.spawn,
          event.frame,
          out,
          hitsOut,
          depth,
        )
      }
    }
    if (event.kind === "skillCast") {
      if (event.requiresConcerto !== undefined) {
        const concerto = this.getResource(event.characterId).concerto
        if (concerto < event.requiresConcerto) {
          const character = getCharacterById(event.characterId)
          const name = character ? character.name : `id ${event.characterId}`
          this.diagnostics.push({
            kind: "insufficientConcerto",
            actor: name,
            concerto,
            required: event.requiresConcerto,
          })
        }
      }
      if (event.concerto) {
        if (event.concerto < 0) {
          this.spend(
            event.characterId,
            "concerto",
            -event.concerto,
            event.frame,
            out,
            hitsOut,
            depth,
          )
        } else {
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
      }
      if (event.forte) {
        this.applyResourceDelta(
          event.characterId,
          "forte",
          event.forte,
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
          this.diagnostics.push({
            kind: "insufficientEnergy",
            actor: name,
            energy,
            cost,
          })
        }
        this.spend(
          event.characterId,
          "energy",
          cost,
          event.frame,
          out,
          hitsOut,
          depth,
        )
      }
      if (event.skillCategory === "Outro Skill") {
        const concerto = this.getResource(event.characterId).concerto
        if (concerto < CONCERTO_CAP) {
          const character = getCharacterById(event.characterId)
          const name = character ? character.name : `id ${event.characterId}`
          this.diagnostics.push({
            kind: "insufficientOutroConcerto",
            actor: name,
            concerto,
            cost: CONCERTO_CAP,
          })
        }
        this.spend(
          event.characterId,
          "concerto",
          CONCERTO_CAP,
          event.frame,
          out,
          hitsOut,
          depth,
        )
      }
    }

    if (event.kind === "swapOut") {
      const expired = this.store.expireOnSourceSwapOut(
        event.characterId,
        event.frame,
        out,
      )
      this.dispatchExpiries(expired, event.frame, out, hitsOut, depth)
    }

    if (event.kind === "swapIn") {
      this.materializePending(event, out)
    }

    const rawCandidates = this.store.findCandidates(event)
    const candidates = rawCandidates.filter(({ def, sourceCharacterId }) => {
      if (
        def.trigger.precondition &&
        !this.evaluator.evaluateUncached(
          def.trigger.precondition,
          subjectAtTrigger(sourceCharacterId),
        )
      )
        return false
      if (def.cooldown) {
        const key = `${def.id}|${sourceCharacterId}`
        const last = this.cooldownLastFired.get(key)
        if (last !== undefined && event.frame - last < def.cooldown * 60)
          return false
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

  private runNegStatusPhase(ctx: PhaseContext): void {
    for (const { def, sourceCharacterId } of ctx.candidates) {
      for (const effect of def.effects) {
        if (effect.kind !== "negStatus") continue
        const statusDef = negStatusDef(effect.status)
        const n = effect.n ?? 0
        switch (effect.op) {
          case "apply": {
            const created = this.target.apply(
              statusDef,
              n,
              ctx.event.frame,
              sourceCharacterId,
            )
            if (created) this.scheduleFirstTick(effect.status, ctx.event.frame)
            this.fireNegStatusInflicted(effect.status, sourceCharacterId, ctx)
            break
          }
          case "reduceBy":
            this.target.reduceBy(effect.status, n)
            break
          case "raiseToMax": {
            const created = this.target.raiseToMax(
              statusDef,
              ctx.event.frame,
              sourceCharacterId,
            )
            if (created) this.scheduleFirstTick(effect.status, ctx.event.frame)
            this.fireNegStatusInflicted(effect.status, sourceCharacterId, ctx)
            break
          }
          case "raiseCap":
            this.target.raiseCap(effect.status, n)
            break
        }
      }
    }
  }

  private scheduleFirstTick(status: NegStatusType, frame: number): void {
    this.target.setNextTick(status, frame + this.intervalFrames(status))
  }

  private currentIntervalMult(status: NegStatusType): number {
    let mult = 1
    for (const inst of this.store.allActive()) {
      for (const effect of inst.def.effects) {
        if (effect.kind === "negStatusMod" && effect.status === status) {
          mult *= effect.intervalMult
        }
      }
    }
    return mult
  }

  private intervalFrames(status: NegStatusType): number {
    const def = negStatusDef(status)
    const frames = Math.round(
      def.tickInterval * 60 * this.currentIntervalMult(status),
    )
    return Math.max(1, frames)
  }

  private fireNegStatusInflicted(
    status: NegStatusType,
    sourceCharacterId: number,
    ctx: PhaseContext,
  ): void {
    this.dispatchEvent(
      {
        kind: "negStatusInflicted",
        characterId: sourceCharacterId,
        status,
        frame: ctx.event.frame,
      },
      ctx.out,
      ctx.hitsOut,
      ctx.depth + 1,
    )
  }

  private runRemoveBuffsPhase(ctx: PhaseContext): void {
    for (const { def } of ctx.candidates) {
      for (const effect of def.effects) {
        if (effect.kind !== "removeBuffs") continue
        const removed = this.store.removeBuffsById(
          effect.buffs,
          ctx.event.frame,
          ctx.out,
        )
        this.dispatchExpiries(
          removed,
          ctx.event.frame,
          ctx.out,
          ctx.hitsOut,
          ctx.depth,
        )
      }
    }
  }

  /**
   * Dispatch a `buffExpired` engine event per ended instance. Each instance is
   * already dropped from the active set, so a cascade of removals that re-ends
   * the same buff finds nothing and terminates.
   */
  private dispatchExpiries(
    removed: BuffInstance[],
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    for (const inst of removed) {
      this.dispatchEvent(
        {
          kind: "buffExpired",
          characterId: inst.targetCharacterId,
          buffId: inst.def.id,
          frame,
        },
        out,
        hitsOut,
        depth + 1,
      )
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
    poolMaturations: PoolMaturation[]
  } {
    const lifecycleEvents: BuffEvent[] = []
    const syntheticEvents: (HitEvent | SustainEvent)[] = []
    this.deferredEmits = []
    this.pendingMaturations = []
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
      poolMaturations: this.pendingMaturations,
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
    // The Energy Regen Multiplier applies only to consuming attacks
    // (negative forte); ER/FR are unaffected by it.
    const energyGainMult =
      stats && (event.forte ?? 0) < 0 ? stats.energyGainMult : 0
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
      energyGainMult,
      event.skillCategory === "Intro Skill",
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

  /**
   * Push `n` Deferred Emits onto the actor's pool, displacing the oldest over
   * `cap` (each converts immediately at `frame`), record each surviving member's
   * maturation for the simulation to park, and sync the `"pool"` resource to the
   * new count. Sole spawn op — `DamageEntry.spawn` routes here, not accrual.
   */
  private spawnIntoPool(
    characterId: number,
    n: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    const config = getCharacterById(characterId)?.emitPool
    if (!config) return
    const spawned: PoolMember[] = []
    for (let i = 0; i < n; i++) {
      spawned.push(
        this.pool.spawn(characterId, frame, frame + config.maturation),
      )
    }
    // FIFO displacement: the oldest over cap convert now, at `frame`. Their parked
    // maturation timers find them gone and no-op, so each converts exactly once.
    const displaced =
      config.cap !== undefined
        ? this.pool.displaceOldest(characterId, config.cap)
        : []
    const displacedIds = new Set(displaced.map((m) => m.id))
    for (const member of spawned) {
      if (displacedIds.has(member.id)) continue
      this.pendingMaturations.push({
        characterId,
        memberId: member.id,
        maturationFrame: member.maturationFrame,
      })
    }
    for (const _ of displaced) {
      this.deferredEmits.push(this.buildPoolEmit(characterId, config, frame))
    }
    this.setResource(
      characterId,
      "pool",
      this.pool.count(characterId),
      frame,
      out,
      hitsOut,
      depth,
    )
  }

  /**
   * Convert the pool member at its maturation frame: drop it from the FIFO, sync
   * the count, and defer the pool's `emit` payload as a Synthetic Hit landing at
   * `convertFrame + emit.actionFrame`. A no-op if the member already converted —
   * this is how the maturation timer is cancelled when displaced early.
   */
  matureMember(
    characterId: number,
    memberId: number,
    convertFrame: number,
  ): {
    lifecycleEvents: BuffEvent[]
    syntheticEvents: (HitEvent | SustainEvent)[]
    deferredEmits: DeferredEmit[]
  } {
    const lifecycleEvents: BuffEvent[] = []
    const syntheticEvents: (HitEvent | SustainEvent)[] = []
    this.deferredEmits = []
    if (!this.pool.remove(characterId, memberId)) {
      return { lifecycleEvents, syntheticEvents, deferredEmits: [] }
    }
    const config = getCharacterById(characterId)?.emitPool
    if (!config) return { lifecycleEvents, syntheticEvents, deferredEmits: [] }
    this.setResource(
      characterId,
      "pool",
      this.pool.count(characterId),
      convertFrame,
      lifecycleEvents,
      syntheticEvents,
      0,
    )
    this.deferredEmits.push(
      this.buildPoolEmit(characterId, config, convertFrame),
    )
    return {
      lifecycleEvents,
      syntheticEvents,
      deferredEmits: this.deferredEmits,
    }
  }

  private buildPoolEmit(
    characterId: number,
    config: EmitPoolConfig,
    convertFrame: number,
  ): DeferredEmit {
    const { emit } = config
    const input: EmitHitInput = {
      buffInstanceKey: buffInstanceKey(POOL_EMIT_DEF.id, characterId),
      def: { ...POOL_EMIT_DEF, name: config.name },
      effect: { kind: "emitHit", damage: emit, icdFrames: 0 },
      effectIndex: 0,
      sourceCharacterId: characterId,
    }
    return { input, landingFrame: convertFrame + emit.actionFrame, depth: 0 }
  }

  private runConvertPhase(ctx: PhaseContext): void {
    for (const { def, sourceCharacterId } of ctx.candidates) {
      for (const effect of def.effects) {
        if (effect.kind !== "convert") continue
        this.convertPool(
          sourceCharacterId,
          effect.count,
          ctx.event.frame,
          ctx.out,
          ctx.hitsOut,
          ctx.depth,
        )
      }
    }
  }

  /**
   * Mature `count` held Deferred Emits now, oldest-first (`"all"` empties the
   * pool), converting each at `frame`. Their parked maturation timers find them
   * gone and no-op. A no-op when nothing is held.
   */
  private convertPool(
    characterId: number,
    count: number | "all",
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    const config = getCharacterById(characterId)?.emitPool
    if (!config) return
    const n = count === "all" ? this.pool.count(characterId) : count
    const converted = this.pool.takeOldest(characterId, n)
    if (converted.length === 0) return
    for (const _ of converted) {
      this.deferredEmits.push(this.buildPoolEmit(characterId, config, frame))
    }
    this.setResource(
      characterId,
      "pool",
      this.pool.count(characterId),
      frame,
      out,
      hitsOut,
      depth,
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
    this.fireResourceConsumed(
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

  /**
   * Cap-honoring cost: silently clamp `before → min(before, cap)` (no event for
   * the discarded overbank), then subtract `cost` through the ledger delta so
   * `resourceCrossed` fires over the real bar and `resourceConsumed` reports the
   * real draw (`amount = cost`), not the ledger's `before − after`.
   */
  private spend(
    characterId: number,
    resource: ResourceKind,
    cost: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ): void {
    const cap = this.nominalCap(characterId, resource)
    const raw = this.resources.getResource(characterId)[resource]
    if (raw > cap) this.resources.setValue(characterId, resource, cap)
    const { before, after } = this.resources.applyDelta(
      characterId,
      resource,
      -cost,
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
    this.fireResourceConsumed(
      characterId,
      resource,
      before,
      after,
      frame,
      out,
      hitsOut,
      depth,
      cost,
    )
  }

  /** Nominal cap read only by `spend()`; never registered, so accrual stays uncapped. */
  private nominalCap(characterId: number, resource: ResourceKind): number {
    const character = getCharacterById(characterId)
    if (resource === "concerto") return CONCERTO_CAP
    if (resource === "energy") return character?.maxEnergy ?? Infinity
    if (resource === "forte") return character?.forteCap ?? Infinity
    return character?.emitPool?.cap ?? Infinity
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
    this.fireResourceConsumed(
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

  /**
   * Fires `resourceConsumed` on any net decrease, threshold-free. `amount`
   * defaults to the ledger drop; `spend()` overrides it with the real `cost` so
   * a clamped overbank never inflates the draw. Never fires on accrual.
   */
  private fireResourceConsumed(
    characterId: number,
    resource: ResourceKind,
    before: number,
    after: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
    amount = before - after,
  ): void {
    if (after >= before) return
    this.dispatchEvent(
      {
        kind: "resourceConsumed",
        characterId,
        resource,
        amount,
        frame,
      },
      out,
      hitsOut,
      depth,
    )
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
    if (effect.op === "sub") {
      this.spend(subjectId, effect.resource, v, frame, out, hitsOut, depth)
    } else if (effect.op === "set") {
      this.setResource(
        subjectId,
        effect.resource,
        v,
        frame,
        out,
        hitsOut,
        depth,
      )
    } else {
      this.applyResourceDelta(
        subjectId,
        effect.resource,
        v,
        frame,
        out,
        hitsOut,
        depth,
      )
    }
  }

  /**
   * Advance internal clock to `frame`; expire instances whose endTime <= frame
   * and emit any Negative Status ticks due at/before it, each snapshotting engine
   * state at its own tick frame.
   */
  tickToFrame(frame: number): {
    lifecycleEvents: BuffEvent[]
    tickEvents: (HitEvent | SustainEvent)[]
  } {
    const lifecycleEvents: BuffEvent[] = []
    const tickEvents: (HitEvent | SustainEvent)[] = []
    for (;;) {
      const tf = this.earliestDueTick(frame)
      if (tf === null) break
      const { lifecycleEvents: le, expired } = this.store.tickToFrame(tf)
      for (const e of le) lifecycleEvents.push(e)
      this.dispatchTimerExpiries(expired, tf, lifecycleEvents, tickEvents)
      this.target.expireBefore(tf)
      for (const inst of this.target.list()) {
        if (inst.nextTickFrame > tf) continue
        tickEvents.push(this.buildStatusTick(inst, tf))
        this.target.setNextTick(
          inst.def.type,
          tf + this.intervalFrames(inst.def.type),
        )
      }
    }
    const { lifecycleEvents: le, expired } = this.store.tickToFrame(frame)
    for (const e of le) lifecycleEvents.push(e)
    this.dispatchTimerExpiries(expired, frame, lifecycleEvents, tickEvents)
    this.target.expireBefore(frame)
    return { lifecycleEvents, tickEvents }
  }

  /**
   * Dispatch a `buffExpired` engine event for each timer-pruned instance so its
   * dependents fan out identically to an explicit removal. Runs outside any
   * dispatch context, so a positive depth resolves in-frame emits inline into
   * the tick stream rather than deferring them. Cascades terminate because each
   * instance is already gone from `active`.
   */
  private dispatchTimerExpiries(
    expired: BuffInstance[],
    frame: number,
    out: BuffEvent[],
    tickEvents: (HitEvent | SustainEvent)[],
  ): void {
    for (const inst of expired) {
      this.dispatchEvent(
        {
          kind: "buffExpired",
          characterId: inst.targetCharacterId,
          buffId: inst.def.id,
          frame,
        },
        out,
        tickEvents,
        1,
      )
    }
  }

  /**
   * Latest finite `endTime` among currently-active buff instances (0 if none).
   * Used to flush trailing expiries past the last authored action so the log
   * carries each buff's real end; permanent (Infinity) instances are ignored.
   */
  latestActiveEndFrame(): number {
    let max = 0
    for (const inst of this.store.allActive()) {
      if (Number.isFinite(inst.endTime) && inst.endTime > max)
        max = inst.endTime
    }
    return max
  }

  private earliestDueTick(frame: number): number | null {
    let min: number | null = null
    for (const inst of this.target.list()) {
      if (
        inst.nextTickFrame <= frame &&
        (min === null || inst.nextTickFrame < min)
      ) {
        min = inst.nextTickFrame
      }
    }
    return min
  }

  private buildStatusTick(inst: NegStatusInstance, frame: number): HitEvent {
    const def = inst.def
    const inflictor = inst.sourceCharacterId
    const hitCtx: HitContext = {
      element: def.element,
      skillType: "Basic Attack",
      labels: [def.label],
    }
    const stats = this.resolveStats(inflictor, hitCtx)
    const damage = computeDamage(
      {
        multiplier: 1,
        element: def.element,
        skillType: "Basic Attack",
        dmgType: def.type,
        source: {
          kind: "statusTick",
          baseUnit: def.baseUnit,
          stacks: inst.stacks,
          stackFactor: def.stackFactor,
        },
      },
      stats,
      this.target.getParams(),
    )
    const post = this.getResource(inflictor)
    return buildHitEvent(
      {
        characterId: inflictor,
        frame,
        skillType: "Basic Attack",
        element: def.element,
        dmgType: def.type,
        multiplier: 1,
        damage,
        cumulativeEnergy: post.energy,
        cumulativeConcerto: post.concerto,
        cumulativeForte: post.forte,
        statsSnapshot: stats,
        activeBuffs: this.activeBuffs(inflictor, hitCtx),
        passiveBuffs: this.passiveBuffs(inflictor),
      },
      {
        kind: "synthetic",
        skillName: def.type,
        sourceBuffId: `negStatus.${def.type}`,
      },
    )
  }

  getTargetParams(): TargetParams {
    return this.target.getParams()
  }

  getTarget(): Target {
    return this.target
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

  /** Base stats + every non-`scaledByStat` buff. No cross-character reader in scope. */
  private resolveIntrinsicStats(
    characterId: number,
    hit?: HitContext,
  ): StatTable {
    const base = this.store.cloneBaseStats(characterId)
    const getBuffStacks = (cid: number, buffId: string): number => {
      return this.store.buffStacksOnTarget(buffId, cid)
    }
    const getStatusStacks = (status: NegStatusType): number => {
      return this.target.stacksOf(status)
    }
    for (const inst of this.activeContributions(characterId, hit)) {
      accumulateStatEffects(
        base,
        { def: inst.def, stacks: inst.stacks, snapshots: inst.snapshots },
        getBuffStacks,
        getStatusStacks,
      )
    }
    return base
  }

  resolveStats(characterId: number, hit?: HitContext): StatTable {
    const stats = this.resolveIntrinsicStats(characterId, hit)
    // `scaledByStat` source reads are hit-agnostic; memoize so multiple effects
    // referencing one character resolve its intrinsic table once.
    const intrinsicByChar = new Map<number, StatTable>()
    const getCharStat = (cid: number, stat: ScalarStatKey): number => {
      let intrinsic = intrinsicByChar.get(cid)
      if (!intrinsic) {
        intrinsic = this.resolveIntrinsicStats(cid)
        intrinsicByChar.set(cid, intrinsic)
      }
      return intrinsic[stat]
    }
    for (const inst of this.activeContributions(characterId, hit)) {
      accumulateScaledStatEffects(
        stats,
        { def: inst.def, stacks: inst.stacks, snapshots: inst.snapshots },
        getCharStat,
      )
    }
    return stats
  }

  /** Test/inspection helper. */
  getOnFieldCharacterId(): number | null {
    return this.onField.current()
  }

  /** Sorted ids of buff instances currently active on `characterId`. */
  activeBuffIds(characterId: number): string[] {
    return this.store.activeBuffIds(characterId)
  }

  /** Footing forced by an active mode buff on `characterId`, if any. */
  forcedFooting(characterId: number): "ground" | "air" | undefined {
    for (const inst of this.activeContributions(characterId)) {
      if (inst.def.forcesFooting !== undefined) return inst.def.forcesFooting
    }
    return undefined
  }

  /** Sorted active buff entries (id, name, stacks, sourceCharacterId) for `characterId`. Instances whose condition evaluates to false are excluded. When `hit` is provided, `appliesToHits` buffs that do not match the hit are also excluded. */
  activeBuffs(characterId: number, hit?: HitContext): ActiveBuff[] {
    const buffs: ActiveBuff[] = this.activeContributions(characterId, hit).map(
      (inst) => ({
        id: inst.def.id,
        name: inst.def.name,
        stacks: inst.stacks,
        sourceCharacterId: inst.sourceCharacterId,
      }),
    )
    for (const s of this.target.list()) {
      buffs.push({
        id: `negStatus.${s.def.type}`,
        name: s.def.type,
        stacks: s.stacks,
        sourceCharacterId: s.sourceCharacterId,
      })
    }
    return buffs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
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
    const { lifecycleEvents, tickEvents } = this.tickToFrame(frame)
    const stats = this.resolveStats(actingCharacterId, hit)
    const activeBuffs = this.activeBuffs(actingCharacterId, hit)
    const passiveBuffs = this.passiveBuffs(actingCharacterId)
    return { stats, activeBuffs, passiveBuffs, lifecycleEvents, tickEvents }
  }

  /**
   * Deep seam: dispatch a hitLanded event and bundle the round-trip — lifecycle
   * events, synthetic hits, and the post-hit Resource State for the actor.
   */
  recordHit(event: HitLandedEvent): HitDispatch {
    const { lifecycleEvents, deferredEmits, poolMaturations } =
      this.onEvent(event)
    const postState = this.getResource(event.characterId)
    return { lifecycleEvents, deferredEmits, poolMaturations, postState }
  }

  recordHeal(event: HealLandedEvent): HitDispatch {
    const { lifecycleEvents, deferredEmits, poolMaturations } =
      this.onEvent(event)
    const postState = this.getResource(event.characterId)
    return { lifecycleEvents, deferredEmits, poolMaturations, postState }
  }
}

/** @internal Bridge for test-only inspection — not part of the public API. */
export interface BuffEngineInternals {
  pendingOutroBuffs: unknown[]
}
