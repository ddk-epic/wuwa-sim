import type {
  BuffDef,
  CoordHitEffect,
  EmitHitEffect,
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
import { buffInstanceKey, EmitHitDispatcher } from "./emit-hit-dispatcher"
import type { DeferredEmit, EmitHitHost } from "./emit-hit-dispatcher"
import { bootstrapSlot } from "../engine-bootstrap"
import { ConditionEvaluator } from "./condition-evaluator"
import type { ConditionSubject, ConditionWorld } from "./condition-evaluator"
import { InstanceStore } from "./instance-store"
import type { Candidate, EngineEvent } from "./instance-store"
import { FootingModule } from "./footing"
import { OnFieldTracker } from "./on-field-tracker"
import { ResourceLedger } from "./resource-ledger"
import { accumulateStatEffects } from "./stat-table-builder"
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
  syntheticEvents: (HitEvent | SustainEvent)[]
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
  /**
   * When true, an `emitHit` with `actionFrame > 0` defers: its decision is taken
   * now but its damage resolves at the landing frame (`trigger + actionFrame`),
   * surfaced as a {@link DeferredEmit}. Off (default) reproduces the legacy
   * land-at-trigger-frame behavior byte-for-byte (ADR-0028, the "flip").
   */
  private honorEmitOffset = false
  /** Deferred emits produced during the in-flight `onEvent` / resolve call. */
  private deferredEmits: DeferredEmit[] = []
  private emitHitHost: EmitHitHost = {
    resolveStats: (id) => this.resolveStats(id),
    applyResourceDelta: (id, resource, delta, frame, out, hitsOut, depth) =>
      this.applyResourceDelta(id, resource, delta, frame, out, hitsOut, depth),
    getResource: (id) => this.getResource(id),
    activeBuffs: (id) => this.activeBuffs(id),
    passiveBuffs: (id) => this.passiveBuffs(id),
    resolveHealTargets: (target, sourceId) => {
      switch (target) {
        case "self":
        case "source":
        case "currentOnField":
          return [sourceId]
        case "team":
          return this.store.getPartyCharacterIds()
        case "nextOnField":
          return []
      }
    },
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

  /** Enable/disable honoring `emitHit.actionFrame` as a landing offset (ADR-0028). */
  setHonorEmitOffset(value: boolean): void {
    this.honorEmitOffset = value
  }

  /** Process a triggering event; returns lifecycle events from any apply/refresh. */
  onEvent(event: EngineEvent): {
    lifecycleEvents: BuffEvent[]
    syntheticEvents: (HitEvent | SustainEvent)[]
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
      syntheticEvents,
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
      if (event.energy) {
        const actorER = this.resolveStats(event.characterId).energyRechargePct
        this.applyResourceDelta(
          event.characterId,
          "energy",
          event.energy * (1 + actorER),
          event.frame,
          out,
          hitsOut,
          depth,
        )
        if (!event.synthetic) {
          const sharedEnergy = event.energy * 0.5 * (1 + actorER)
          for (const teammateId of this.store.getPartyCharacterIds()) {
            if (teammateId !== event.characterId) {
              this.applyResourceDelta(
                teammateId,
                "energy",
                sharedEnergy,
                event.frame,
                out,
                hitsOut,
                depth,
              )
            }
          }
        }
      }
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
      if (event.forte) {
        const actorFRPct = this.resolveStats(event.characterId).forteRechargePct
        this.applyResourceDelta(
          event.characterId,
          "forte",
          event.forte * (1 + actorFRPct),
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

    const landingFrame = this.honorEmitOffset
      ? frame + effect.damage.actionFrame
      : frame
    if (landingFrame > frame) {
      // Defer: damage + chain resolve later, at the landing frame, in frame
      // order against intervening authored entries. The simulation drains these.
      this.deferredEmits.push({ input, landingFrame, depth })
      return
    }

    const hit = this.emitHitDispatcher.resolve(
      input,
      frame,
      depth,
      this.emitHitHost,
      out,
      hitsOut,
    )
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
   * Resolve a deferred emit at its landing frame (ADR-0028). The caller must
   * have advanced engine state to `d.landingFrame` first (e.g. via `resolveHit`)
   * so the snapshot and resource reads are frame-honest. Returns the synthetic
   * event plus any lifecycle/synthetic/deferred output its chain produced.
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
    const event = this.emitHitDispatcher.resolve(
      d.input,
      d.landingFrame,
      d.depth,
      this.emitHitHost,
      lifecycleEvents,
      syntheticEvents,
    )
    // effect is EmitHitEffect on the deferred path (coordHit never defers).
    this.fireEmitChain(
      d.input.effect as EmitHitEffect,
      d.input.sourceCharacterId,
      d.input.def.id,
      d.landingFrame,
      lifecycleEvents,
      syntheticEvents,
      d.depth,
    )
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
    const hit = this.emitHitDispatcher.dispatch(
      {
        buffInstanceKey: buffInstanceKey(def.id, sourceCharacterId),
        def,
        effect,
        effectIndex,
        sourceCharacterId,
      },
      { frame, depth },
      this.emitHitHost,
      out,
      hitsOut,
    )
    if (!hit) return
    hitsOut.push(hit)
    // Bypass: coord events are NOT re-entered into the trigger matcher.
    // No dispatchEvent call here — coordHit→coord chain is structurally impossible.
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

  resolveStats(characterId: number): StatTable {
    if (this.resolvingStats.has(characterId)) {
      return this.store.cloneBaseStats(characterId)
    }
    this.resolvingStats.add(characterId)
    try {
      const base = this.store.cloneBaseStats(characterId)
      const contributions = this.store.getActiveTargeting(characterId)
      const getCharStat = (cid: number, stat: ScalarStatKey): number => {
        return this.resolveStats(cid)[stat]
      }
      for (const inst of contributions) {
        if (
          inst.def.condition &&
          !this.evaluator.evaluateCached(inst.def.condition, inst, characterId)
        ) {
          continue
        }
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

  /** Sorted active buff entries (id, name, stacks, sourceCharacterId) for `characterId`. Instances whose condition evaluates to false are excluded. */
  activeBuffs(characterId: number): ActiveBuff[] {
    return this.store
      .getActiveTargeting(characterId)
      .filter(
        (inst) =>
          !inst.def.condition ||
          this.evaluator.evaluateCached(inst.def.condition, inst, characterId),
      )
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
  resolveHit(actingCharacterId: number, frame: number): ResolvedHit {
    const { lifecycleEvents } = this.tickToFrame(frame)
    const stats = this.resolveStats(actingCharacterId)
    const activeBuffs = this.activeBuffs(actingCharacterId)
    const passiveBuffs = this.passiveBuffs(actingCharacterId)
    return { stats, activeBuffs, passiveBuffs, lifecycleEvents }
  }

  /**
   * Deep seam: dispatch a hitLanded event and bundle the round-trip — lifecycle
   * events, synthetic hits, and the post-hit Resource State for the actor.
   */
  recordHit(event: HitLandedEvent): HitDispatch {
    const { lifecycleEvents, syntheticEvents, deferredEmits } =
      this.onEvent(event)
    const postState = this.getResource(event.characterId)
    return { lifecycleEvents, syntheticEvents, deferredEmits, postState }
  }

  recordHeal(event: HealLandedEvent): HitDispatch {
    const { lifecycleEvents, syntheticEvents, deferredEmits } =
      this.onEvent(event)
    const postState = this.getResource(event.characterId)
    return { lifecycleEvents, syntheticEvents, deferredEmits, postState }
  }
}

/** @internal Bridge for test-only inspection — not part of the public API. */
export interface BuffEngineInternals {
  pendingOutroBuffs: unknown[]
}
