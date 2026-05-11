import type {
  BuffDef,
  BuffInstance,
  Condition,
  EmitHitEffect,
  ResourceEffect,
  ResourceKind,
  ResourceState,
} from "#/types/buff"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { ActiveBuff, BuffEvent, HitEvent } from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import { getCharacterById } from "./catalog"
import { buffInstanceKey, EmitHitDispatcher } from "./emit-hit-dispatcher"
import type { EmitHitHost } from "./emit-hit-dispatcher"
import { bootstrapSlot } from "./engine-bootstrap"
import { InstanceStore } from "./instance-store"
import type { Candidate, EngineEvent } from "./instance-store"
import { OnFieldTracker } from "./on-field-tracker"
import { ResourceLedger } from "./resource-ledger"
import { accumulateStatEffects } from "./stat-table-builder"

export type { EngineEvent } from "./instance-store"

type ConditionCacheVersions = {
  store: number
  resources: number
  onField: number
}

type ConditionCacheKey = {
  buffId: string
  sourceCharacterId: number
  targetCharacterId: number
  actingCharacterId: number
}

function conditionCacheKeyString(k: ConditionCacheKey): string {
  return `${k.buffId}|${k.sourceCharacterId}|${k.targetCharacterId}|${k.actingCharacterId}`
}

export type HitLandedEvent = Extract<EngineEvent, { kind: "hitLanded" }>

export interface ResolvedHit {
  stats: StatTable
  activeBuffs: ActiveBuff[]
  lifecycleEvents: BuffEvent[]
}

export interface HitDispatch {
  lifecycleEvents: BuffEvent[]
  syntheticHits: HitEvent[]
  postState: ResourceState
}

interface PhaseContext {
  event: EngineEvent
  candidates: readonly Candidate[]
  out: BuffEvent[]
  hitsOut: HitEvent[]
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

export class BuffEngine {
  private store = new InstanceStore()
  private resources = new ResourceLedger()
  private onField = new OnFieldTracker()
  private cooldownLastFired = new Map<string, number>()
  private emitHitDispatcher = new EmitHitDispatcher({
    chainDepthCap: EMIT_HIT_CHAIN_DEPTH_CAP,
  })
  private emitHitHost: EmitHitHost = {
    resolveStats: (id) => this.resolveStats(id),
    applyResourceDelta: (id, resource, delta, frame, out, hitsOut, depth) =>
      this.applyResourceDelta(id, resource, delta, frame, out, hitsOut, depth),
    getResource: (id) => this.getResource(id),
    activeBuffs: (id) => this.activeBuffs(id),
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
    {
      name: "consume",
      run: (ctx) => this.store.runConsumePhase(ctx.event, ctx.out),
    },
  ]

  /** Test/inspection helper exposing the dispatch phase order as a value. */
  phaseOrder(): readonly string[] {
    return this.phases.map((p) => p.name)
  }

  bootstrap(input: BootstrapInput): { lifecycleEvents: BuffEvent[] } {
    this.store.clear()
    this.resources.clear()
    this.onField.clear()
    this.cooldownLastFired.clear()
    this.emitHitDispatcher.reset()

    const slots: number[] = []
    for (let i = 0; i < input.slots.length; i++) {
      const charId = input.slots[i]
      slots.push(charId ?? -1)
      if (charId === null) continue
      const slot = bootstrapSlot(charId, input.loadouts[i] ?? null)
      if (!slot) continue
      this.store.setBaseStats(slot.charId, slot.baseStats)
      this.store.setTriggerable(slot.charId, slot.triggerable)
      for (const inst of slot.permanentInstances) {
        this.store.pushPermanentInstance(inst)
      }
      this.resources.ensureState(slot.charId)
    }
    this.store.setSlots(slots)
    return { lifecycleEvents: [] }
  }

  getResource(characterId: number): ResourceState {
    return this.resources.getResource(characterId)
  }

  /** Process a triggering event; returns lifecycle events from any apply/refresh. */
  onEvent(event: EngineEvent): {
    lifecycleEvents: BuffEvent[]
    syntheticHits: HitEvent[]
  } {
    const lifecycleEvents: BuffEvent[] = []
    const syntheticHits: HitEvent[] = []

    // Implicit swap inference: an authored skillCast by a different character
    // than the current on-field implies swapOut(prev) → swapIn(next).
    if (event.kind === "skillCast") {
      const swap = this.onField.inferSwap(event.characterId)
      if (swap) {
        if (swap.prev !== null) {
          this.dispatchEvent(
            { kind: "swapOut", characterId: swap.prev, frame: event.frame },
            lifecycleEvents,
            syntheticHits,
            0,
          )
        }
        this.onField.setCurrent(swap.next)
        this.dispatchEvent(
          { kind: "swapIn", characterId: swap.next, frame: event.frame },
          lifecycleEvents,
          syntheticHits,
          0,
        )
      }
    }

    this.dispatchEvent(event, lifecycleEvents, syntheticHits, 0)
    return { lifecycleEvents, syntheticHits }
  }

  private dispatchEvent(
    event: EngineEvent,
    out: BuffEvent[],
    hitsOut: HitEvent[],
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
          const sharedEnergy = event.energy * 0.5
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
      if (event.skillType === "Resonance Liberation") {
        const energy = this.getResource(event.characterId).energy
        if (energy < 100) {
          const character = getCharacterById(event.characterId)
          const name = character ? character.name : `id ${event.characterId}`
          console.warn(
            `[BuffEngine] Resonance Liberation cast by ${name} with insufficient energy (${energy} < 100)`,
          )
        }
      }
    }

    if (event.kind === "swapOut") {
      this.store.expireOnSourceSwapOut(event.characterId, event.frame, out)
    }

    if (event.kind === "swapIn") {
      this.store.drainPendingNextOnField(event.characterId, event.frame, out)
    }

    const rawCandidates = this.store.findCandidates(event)
    const candidates = rawCandidates.filter(({ def, sourceCharacterId }) => {
      if (!def.cooldown) return true
      const key = `${def.id}|${sourceCharacterId}`
      const last = this.cooldownLastFired.get(key)
      return last === undefined || event.frame - last >= def.cooldown * 60
    })
    for (const { def, sourceCharacterId } of candidates) {
      if (def.cooldown) {
        this.cooldownLastFired.set(
          `${def.id}|${sourceCharacterId}`,
          event.frame,
        )
      }
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
    for (const { def, sourceCharacterId } of ctx.candidates) {
      if (def.target.kind === "nextOnField") {
        this.store.pushPendingNextOnField(
          def,
          sourceCharacterId,
          ctx.event.frame,
        )
        continue
      }
      const targetIds = this.store.resolveTargetIds(def, sourceCharacterId)
      for (const targetId of targetIds) {
        this.store.applyBuff(
          def,
          sourceCharacterId,
          targetId,
          ctx.event.frame,
          ctx.out,
        )
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
    hitsOut: HitEvent[],
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

    // Chain: each synthetic hit fires its own hitLanded event subject to
    // per-instance ICDs. Energy/concerto already applied above; pass 0 so
    // the recursive dispatch's resource phase does not double-count.
    this.dispatchEvent(
      {
        kind: "hitLanded",
        characterId: sourceCharacterId,
        skillType: effect.skillType ?? "Coordinated Attack",
        dmgType: effect.damage.dmgType,
        synthetic: true,
        frame,
      },
      out,
      hitsOut,
      depth + 1,
    )
  }

  private applyResourceDelta(
    characterId: number,
    resource: ResourceKind,
    delta: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: HitEvent[],
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
    hitsOut: HitEvent[],
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
    hitsOut: HitEvent[],
    depth: number,
  ): void {
    if (before === after) return
    const direction: "up" | "down" = after > before ? "up" : "down"
    const thresholds = this.store.findCrossedThresholds(
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
    hitsOut: HitEvent[],
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
    const base = this.store.cloneBaseStats(characterId)
    const contributions = this.store.getActiveTargeting(characterId)
    for (const inst of contributions) {
      if (
        inst.def.condition &&
        !this.cachedEvaluateCondition(inst.def.condition, inst, characterId)
      ) {
        continue
      }
      accumulateStatEffects(base, {
        def: inst.def,
        stacks: inst.stacks,
        snapshots: inst.snapshots,
      })
    }
    return base
  }

  private conditionCache = new Map<string, boolean>()
  private conditionCacheVersions: ConditionCacheVersions | null = null
  private conditionEvalCount_ = 0

  private cachedEvaluateCondition(
    cond: Condition,
    inst: BuffInstance,
    actingCharacterId: number,
  ): boolean {
    const versions: ConditionCacheVersions = {
      store: this.store.mutationVersion(),
      resources: this.resources.mutationVersion(),
      onField: this.onField.mutationVersion(),
    }
    const prev = this.conditionCacheVersions
    if (
      prev === null ||
      prev.store !== versions.store ||
      prev.resources !== versions.resources ||
      prev.onField !== versions.onField
    ) {
      this.conditionCache.clear()
      this.conditionCacheVersions = versions
    }
    const cacheKey: ConditionCacheKey = {
      buffId: inst.def.id,
      sourceCharacterId: inst.sourceCharacterId,
      targetCharacterId: inst.targetCharacterId,
      actingCharacterId,
    }
    const key = conditionCacheKeyString(cacheKey)
    const cached = this.conditionCache.get(key)
    if (cached !== undefined) return cached
    const result = this.evaluateCondition(cond, inst)
    this.conditionEvalCount_++
    this.conditionCache.set(key, result)
    return result
  }

  /** @internal Test-only: counts evaluateCondition calls that bypassed the cache. */
  conditionEvalCountForTest(): number {
    return this.conditionEvalCount_
  }

  private evaluateCondition(cond: Condition, inst: BuffInstance): boolean {
    switch (cond.kind) {
      case "buffActive": {
        const subjectId =
          cond.on === "source" ? inst.sourceCharacterId : inst.targetCharacterId
        return this.store.hasActiveOnTarget(cond.buffId, subjectId)
      }
      case "onField":
        return this.onField.isOnField(inst.targetCharacterId)
      case "actorIsOnField":
        return this.onField.isOnField(inst.sourceCharacterId)
      case "resourceAtLeast": {
        const subjectId =
          cond.on === "source" ? inst.sourceCharacterId : inst.targetCharacterId
        return this.resources.getResource(subjectId)[cond.resource] >= cond.n
      }
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

  /** Sorted active buff entries (id, name, stacks, sourceCharacterId) for `characterId`. */
  activeBuffs(characterId: number): ActiveBuff[] {
    return this.store.activeBuffs(characterId)
  }

  /**
   * Deep seam: advance to `frame`, resolve the actor's stat table, and snapshot
   * the active buffs — the inputs every per-hit damage computation needs.
   */
  resolveHit(actingCharacterId: number, frame: number): ResolvedHit {
    const { lifecycleEvents } = this.tickToFrame(frame)
    const stats = this.resolveStats(actingCharacterId)
    const activeBuffs = this.activeBuffs(actingCharacterId)
    return { stats, activeBuffs, lifecycleEvents }
  }

  /**
   * Deep seam: dispatch a hitLanded event and bundle the round-trip — lifecycle
   * events, synthetic hits, and the post-hit Resource State for the actor.
   */
  recordHit(event: HitLandedEvent): HitDispatch {
    const { lifecycleEvents, syntheticHits } = this.onEvent(event)
    const postState = this.getResource(event.characterId)
    return { lifecycleEvents, syntheticHits, postState }
  }
}

/** @internal Bridge for test-only inspection — not part of the public API. */
export interface BuffEngineInternals {
  store: { pendingNextOnFieldCount: () => number }
}
