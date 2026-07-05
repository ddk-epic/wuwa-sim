import type {
  BuffDef,
  BuffInstance,
  ResourceKind,
  StackingPolicy,
  Trigger,
} from "#/types/buff"
import { GLOBAL_TARGET_ID } from "#/types/buff"
import type { NegStatusType } from "#/data/neg-status-types"
import type { SkillCategory } from "#/types/character"
import type { ActiveBuff, BuffEvent } from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import { emptyStatTable } from "#/types/stat-table"
import { getCharacterById } from "../loadout/catalog"
import { cloneStats, freezeSnapshots, matchesAxis } from "./apply-stat-effects"

const DEFAULT_STACKING: StackingPolicy = { max: 1, onRetrigger: "refresh" }

export type EngineEvent =
  | {
      kind: "skillCast"
      characterId: number
      skillCategory: SkillCategory
      stageId?: string
      skill?: string
      frame: number
      /** Stage-level concerto attached to this cast (action-level). */
      concerto?: number
      /** Stage-level forte applied on cast (action-level). Capped by forteCap. */
      forte?: number
      /** Energy consumed on cast (Resonance Liberation only). Defaults to 100. */
      resonanceCost?: number
      /** Concerto Energy required for this cast to be available; advisory only. */
      requiresConcerto?: number
    }
  | {
      kind: "hitLanded"
      characterId: number
      skillCategory: SkillCategory
      dmgType: string
      synthetic?: boolean
      frame: number
      stageId?: string
      skill?: string
      /** 1-based (DamageEntry order). */
      hitIndex?: number
      /** Per-hit energy gained by the actor. Implicit `resource` effect. */
      energy?: number
      /** Per-hit concerto gained by the actor. Implicit `resource` effect. */
      concerto?: number
      /** Per-hit forte gained by the actor. Scaled by forteRechargePct. Actor-only. */
      forte?: number
      /** Deferred Emits this hit pushes onto the actor's Emit Pool. Authored-only; not FR-scaled. */
      spawn?: number
      /** Buff def id that produced this synthetic hit via emitHit; undefined for authored hits. */
      sourceBuffId?: string
      /** Target's negative statuses stamped at dispatch, for trigger-time gating. */
      targetStatuses?: NegStatusType[]
    }
  | {
      kind: "healLanded"
      characterId: number
      skillCategory: SkillCategory
      frame: number
      stageId?: string
      skill?: string
      hitIndex?: number
    }
  | { kind: "swapIn"; characterId: number; frame: number }
  | { kind: "swapOut"; characterId: number; frame: number }
  | {
      kind: "resourceCrossed"
      characterId: number
      resource: ResourceKind
      threshold: number
      direction: "up" | "down"
      frame: number
    }
  | {
      kind: "resourceConsumed"
      characterId: number
      resource: ResourceKind
      /** Magnitude of the net decrease (before - after), always > 0. */
      amount: number
      frame: number
    }
  | {
      kind: "negStatusInflicted"
      characterId: number
      status: NegStatusType
      frame: number
    }
  | {
      kind: "buffExpired"
      /** Target character of the ended instance. */
      characterId: number
      buffId: string
      frame: number
    }

export interface Candidate {
  def: BuffDef
  sourceCharacterId: number
}

/**
 * Owns the active Buff Instance list, the trigger-by-source registry, the
 * `nextOnField` pending queue, and the per-character `baseStats` + slot map.
 * Instance lifecycle (apply, refresh, expire, consume) lives here. Resource
 * State and Acting/On-Field state live in their own modules.
 */
export class InstanceStore {
  private active: BuffInstance[] = []
  private triggerableBySource = new Map<number, BuffDef[]>()
  /** Gate buff id → def ids of gated (suspendable-duration) buffs it drives. */
  private gatedByGate = new Map<string, Set<string>>()
  private baseStats = new Map<number, StatTable>()
  private slotsBySlotIndex: number[] = []
  private version_ = 0
  private nextInstanceId = 0

  clear(): void {
    this.active = []
    this.triggerableBySource.clear()
    this.gatedByGate.clear()
    this.baseStats.clear()
    this.slotsBySlotIndex = []
    this.nextInstanceId = 0
    this.version_++
  }

  /** Monotonic counter that bumps on every mutation to the active instance set. */
  mutationVersion(): number {
    return this.version_
  }

  setSlots(slots: number[]): void {
    this.slotsBySlotIndex = slots
  }

  getPartyCharacterIds(): number[] {
    return this.slotsBySlotIndex.filter((id) => id !== -1)
  }

  setBaseStats(characterId: number, stats: StatTable): void {
    this.baseStats.set(characterId, stats)
  }

  setTriggerable(characterId: number, defs: BuffDef[]): void {
    this.triggerableBySource.set(characterId, defs)
    this.indexGates(defs)
  }

  appendTriggerable(characterId: number, defs: BuffDef[]): void {
    const existing = this.triggerableBySource.get(characterId) ?? []
    this.triggerableBySource.set(characterId, [...existing, ...defs])
    this.indexGates(defs)
  }

  private indexGates(defs: BuffDef[]): void {
    for (const def of defs) {
      const gate = durationGate(def)
      if (gate === undefined) continue
      let gated = this.gatedByGate.get(gate)
      if (gated === undefined) {
        gated = new Set()
        this.gatedByGate.set(gate, gated)
      }
      gated.add(def.id)
    }
  }

  pushPermanentInstance(inst: Omit<BuffInstance, "instanceId">): void {
    this.active.push({ ...inst, instanceId: this.nextInstanceId++ })
    this.version_++
  }

  cloneBaseStats(characterId: number): StatTable {
    const cached = this.baseStats.get(characterId)
    if (cached) return cloneStats(cached)
    const character = getCharacterById(characterId)
    return {
      ...emptyStatTable(),
      atkBase: character ? character.stats.max.atk : 0,
      hpBase: character ? character.stats.max.hp : 0,
      defBase: character ? character.stats.max.def : 0,
    }
  }

  allActive(): readonly BuffInstance[] {
    return this.active
  }

  /** Sorted (by def.id) instances targeting `characterId` for stat resolution. */
  getActiveTargeting(characterId: number): BuffInstance[] {
    return this.active
      .filter((inst) => inst.global || inst.targetCharacterId === characterId)
      .sort((a, b) => (a.def.id < b.def.id ? -1 : a.def.id > b.def.id ? 1 : 0))
  }

  activeBuffIds(characterId: number): string[] {
    return this.active
      .filter((inst) => inst.global || inst.targetCharacterId === characterId)
      .map((inst) => inst.def.id)
      .sort()
  }

  activeBuffs(characterId: number): ActiveBuff[] {
    return this.active
      .filter((inst) => inst.global || inst.targetCharacterId === characterId)
      .map((inst) => ({
        id: inst.def.id,
        name: inst.def.name,
        stacks: inst.stacks,
        sourceCharacterId: inst.sourceCharacterId,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }

  /** Stacks of the active instance with `buffId` on `characterId` (0 if none). */
  buffStacksOnTarget(buffId: string, characterId: number): number {
    const inst = this.active.find(
      (i) =>
        i.def.id === buffId &&
        (i.global || i.targetCharacterId === characterId),
    )
    return inst?.stacks ?? 0
  }

  /** Returns true when any active instance with the given def.id targets `characterId` or is global. */
  hasActiveOnTarget(buffId: string, targetCharacterId: number): boolean {
    return this.active.some(
      (i) =>
        i.def.id === buffId &&
        (i.global || i.targetCharacterId === targetCharacterId),
    )
  }

  resolveTargetIds(def: BuffDef, sourceCharacterId: number): number[] {
    if (def.target == null) return [sourceCharacterId]
    switch (def.target.kind) {
      case "self": {
        const ids = def.target.characterId
        if (ids == null) return [sourceCharacterId]
        const allowed = Array.isArray(ids) ? ids : [ids]
        return allowed.includes(sourceCharacterId) ? [sourceCharacterId] : []
      }
      case "nextOnField":
        throw new Error(
          `resolveTargetIds called with nextOnField buff "${def.id}" — use applyOrDefer`,
        )
      case "global":
        throw new Error(
          `resolveTargetIds called with global buff "${def.id}" — use applyOrDefer`,
        )
    }
  }

  /** Find triggerable BuffDefs whose trigger matches `event`, sorted by def.id. */
  findCandidates(event: EngineEvent): Candidate[] {
    const candidates: Candidate[] = []
    for (const [sourceId, defs] of this.triggerableBySource) {
      for (const def of defs) {
        if (matchesTrigger(def.trigger, event, sourceId)) {
          candidates.push({ def, sourceCharacterId: sourceId })
        }
      }
    }
    candidates.sort((a, b) =>
      a.def.id < b.def.id ? -1 : a.def.id > b.def.id ? 1 : 0,
    )
    return candidates
  }

  /**
   * Drop instances whose source matches `sourceCharacterId` and that opt into
   * expiry on swapOut. Returns the removed instances for buffExpired fan-out.
   */
  expireOnSourceSwapOut(
    sourceCharacterId: number,
    frame: number,
    out: BuffEvent[],
  ): BuffInstance[] {
    const remaining: BuffInstance[] = []
    const removed: BuffInstance[] = []
    for (const inst of this.active) {
      if (
        inst.def.expiresOnSourceSwapOut &&
        inst.sourceCharacterId === sourceCharacterId
      ) {
        emit(out, inst.def, {
          kind: "buffExpired",
          instanceId: inst.instanceId,
          buffId: inst.def.id,
          buffName: inst.def.name,
          sourceCharacterId: inst.sourceCharacterId,
          targetCharacterId: inst.targetCharacterId,
          frame,
          stacks: inst.stacks,
        })
        removed.push(inst)
      } else {
        remaining.push(inst)
      }
    }
    if (removed.length > 0) this.version_++
    this.active = remaining
    this.pauseGatedByRemoved(removed, frame)
    return removed
  }

  /** Resume gated instances on `targetId` whose gate `gateId` just became present. */
  private resumeGatedBy(gateId: string, targetId: number, frame: number): void {
    const gated = this.gatedByGate.get(gateId)
    if (gated === undefined) return
    for (const inst of this.active) {
      if (inst.targetCharacterId !== targetId) continue
      if (inst.gatedRemaining === undefined) continue
      if (!gated.has(inst.def.id)) continue
      // endTime is mutable and non-monotonic here: a paused gated instance
      // resumes from its banked frames, so it can move past any value stamped
      // at apply. latestActiveEndFrame and the trailing-expiry flush must read
      // it live, never cache it.
      inst.endTime = frame + inst.gatedRemaining
      inst.gatedRemaining = undefined
      this.version_++
    }
  }

  /** Pause gated instances on `targetId` whose gate `gateId` just left; bank remaining frames. */
  private pauseGatedInstances(
    gateId: string,
    targetId: number,
    frame: number,
  ): void {
    const gated = this.gatedByGate.get(gateId)
    if (gated === undefined) return
    for (const inst of this.active) {
      if (inst.targetCharacterId !== targetId) continue
      if (inst.gatedRemaining !== undefined) continue
      if (!gated.has(inst.def.id)) continue
      inst.gatedRemaining = Math.max(0, inst.endTime - frame)
      inst.endTime = Number.POSITIVE_INFINITY
      this.version_++
    }
  }

  /** Pause gated instances relying on any gate among the removed instances. */
  private pauseGatedByRemoved(removed: BuffInstance[], frame: number): void {
    for (const inst of removed) {
      if (this.gatedByGate.has(inst.def.id)) {
        this.pauseGatedInstances(inst.def.id, inst.targetCharacterId, frame)
      }
    }
  }

  /** Decrement stacks for instances whose consumedBy filter matches `event`. */
  runConsumePhase(event: EngineEvent, out: BuffEvent[]): void {
    const remaining: BuffInstance[] = []
    let mutated = false
    for (const inst of this.active) {
      const filter = inst.def.consumedBy
      if (!filter || !matchesTrigger(filter, event, inst.sourceCharacterId)) {
        remaining.push(inst)
        continue
      }
      const next = inst.stacks - 1
      if (next <= 0) {
        emit(out, inst.def, {
          kind: "buffConsumed",
          instanceId: inst.instanceId,
          buffId: inst.def.id,
          buffName: inst.def.name,
          sourceCharacterId: inst.sourceCharacterId,
          targetCharacterId: inst.targetCharacterId,
          frame: event.frame,
          stacks: 0,
        })
        mutated = true
      } else {
        inst.stacks = next
        remaining.push(inst)
        mutated = true
      }
    }
    if (mutated) this.version_++
    this.active = remaining
  }

  /** `expired` carries instances fully pruned by timer, for buffExpired dispatch. */
  tickToFrame(frame: number): {
    lifecycleEvents: BuffEvent[]
    expired: BuffInstance[]
  } {
    const lifecycleEvents: BuffEvent[] = []
    const remaining: BuffInstance[] = []
    const expired: BuffInstance[] = []
    let pruned = false
    for (const inst of this.active) {
      if (inst.stackExpiries) {
        let dropped = false
        while (
          inst.stackExpiries.length > 0 &&
          inst.stackExpiries[0] <= frame
        ) {
          inst.stackExpiries.shift()
          dropped = true
          pruned = true
        }
        inst.stacks = inst.stackExpiries.length
        if (inst.stackExpiries.length > 0) {
          inst.endTime = inst.stackExpiries[inst.stackExpiries.length - 1]
          if (dropped)
            emit(lifecycleEvents, inst.def, stacksChanged(inst, frame))
        }
      }
      if (inst.endTime <= frame) {
        emit(lifecycleEvents, inst.def, {
          kind: "buffExpired",
          instanceId: inst.instanceId,
          buffId: inst.def.id,
          buffName: inst.def.name,
          sourceCharacterId: inst.sourceCharacterId,
          targetCharacterId: inst.targetCharacterId,
          frame: inst.endTime,
          stacks: inst.stacks,
        })
        expired.push(inst)
      } else {
        remaining.push(inst)
      }
    }
    if (remaining.length !== this.active.length || pruned) this.version_++
    this.active = remaining
    this.pauseGatedByRemoved(expired, frame)
    return { lifecycleEvents, expired }
  }

  /**
   * Discover the unique set of thresholds crossed by a transition (`before` →
   * `after`) on `(characterId,resource)`, filtered to triggers registered in
   * the registry. Caller turns these into synthetic resourceCrossed events.
   */
  applyBuff(
    def: BuffDef,
    sourceCharacterId: number,
    targetCharacterId: number,
    frame: number,
    out: BuffEvent[],
  ): void {
    const stacking = def.stacking ?? DEFAULT_STACKING
    const existing = this.active.find(
      (i) =>
        i.def.id === def.id &&
        i.targetCharacterId === targetCharacterId &&
        (!def.perSource || i.sourceCharacterId === sourceCharacterId),
    )
    const newEndTime = computeEndTime(
      def,
      frame,
      targetCharacterId,
      (buffId, targetId) => {
        // A self/target buff may inherit a global parent (e.g. Self Gravitation
        // off the global Outer Stellarealm); fall back to the global instance.
        const parent =
          this.active.find(
            (i) => i.def.id === buffId && i.targetCharacterId === targetId,
          ) ??
          this.active.find(
            (i) =>
              i.def.id === buffId && i.targetCharacterId === GLOBAL_TARGET_ID,
          )
        return parent?.endTime
      },
    )

    // A gated duration whose gate is absent at apply starts paused: endTime
    // frozen at infinity with its full length banked to resume later.
    const gateId = durationGate(def)
    const gatePaused =
      gateId !== undefined && !this.hasActiveOnTarget(gateId, targetCharacterId)
    const appliedEndTime = gatePaused ? Number.POSITIVE_INFINITY : newEndTime
    const bankedRemaining = gatePaused ? durationFrames(def) : undefined

    if (!existing) {
      const isGlobal = targetCharacterId === GLOBAL_TARGET_ID
      const instanceId = this.nextInstanceId++
      this.active.push({
        def,
        instanceId,
        sourceCharacterId,
        targetCharacterId,
        endTime: appliedEndTime,
        stacks: 1,
        appliedFrame: frame,
        snapshots: freezeSnapshots(def, 1, (cid, buffId) =>
          this.buffStacksOnTarget(buffId, cid),
        ),
        ...(bankedRemaining !== undefined
          ? { gatedRemaining: bankedRemaining }
          : {}),
        // global is typed `?: true`; the assertion stops it widening to boolean.
        ...(isGlobal ? { global: true as const } : {}),
      })
      this.version_++
      emit(out, def, {
        kind: "buffApplied",
        instanceId,
        buffId: def.id,
        buffName: def.name,
        sourceCharacterId,
        targetCharacterId,
        frame,
        stacks: 1,
      })
      this.checkNonStackingGroup(def, targetCharacterId)
      this.resumeGatedBy(def.id, targetCharacterId, frame)
      return
    }

    switch (stacking.onRetrigger) {
      case "ignore":
        return
      case "refresh":
        existing.endTime = appliedEndTime
        existing.gatedRemaining = bankedRemaining
        existing.sourceCharacterId = sourceCharacterId
        this.version_++
        emit(out, def, {
          kind: "buffRefreshed",
          instanceId: existing.instanceId,
          buffId: def.id,
          buffName: def.name,
          sourceCharacterId,
          targetCharacterId,
          frame,
          stacks: existing.stacks,
        })
        return
      case "addStackRefresh":
        existing.stacks = Math.min(existing.stacks + 1, stacking.max)
        existing.endTime = appliedEndTime
        existing.gatedRemaining = bankedRemaining
        existing.sourceCharacterId = sourceCharacterId
        this.version_++
        emit(out, def, {
          kind: "buffRefreshed",
          instanceId: existing.instanceId,
          buffId: def.id,
          buffName: def.name,
          sourceCharacterId,
          targetCharacterId,
          frame,
          stacks: existing.stacks,
        })
        return
      case "addStackKeep":
        existing.stacks = Math.min(existing.stacks + 1, stacking.max)
        this.version_++
        emit(out, def, {
          kind: "buffRefreshed",
          instanceId: existing.instanceId,
          buffId: def.id,
          buffName: def.name,
          sourceCharacterId,
          targetCharacterId,
          frame,
          stacks: existing.stacks,
        })
        return
      case "addStackIndependent": {
        const queue = existing.stackExpiries ?? [existing.endTime]
        queue.push(newEndTime)
        queue.sort((a, b) => a - b)
        while (queue.length > stacking.max) queue.shift()
        existing.stackExpiries = queue
        existing.stacks = queue.length
        existing.endTime = queue[queue.length - 1]
        existing.sourceCharacterId = sourceCharacterId
        this.version_++
        emit(out, def, stacksChanged(existing, frame))
        return
      }
      case "replace": {
        emit(out, def, {
          kind: "buffExpired",
          instanceId: existing.instanceId,
          buffId: def.id,
          buffName: def.name,
          sourceCharacterId: existing.sourceCharacterId,
          targetCharacterId,
          frame,
          stacks: existing.stacks,
        })
        this.active = this.active.filter((i) => i !== existing)
        const instanceId = this.nextInstanceId++
        this.active.push({
          def,
          instanceId,
          sourceCharacterId,
          targetCharacterId,
          endTime: newEndTime,
          stacks: 1,
          appliedFrame: frame,
          snapshots: freezeSnapshots(def, 1, (cid, buffId) =>
            this.buffStacksOnTarget(buffId, cid),
          ),
        })
        this.version_++
        emit(out, def, {
          kind: "buffApplied",
          instanceId,
          buffId: def.id,
          buffName: def.name,
          sourceCharacterId,
          targetCharacterId,
          frame,
          stacks: 1,
        })
        this.checkNonStackingGroup(def, targetCharacterId)
        return
      }
    }
  }

  private checkNonStackingGroup(def: BuffDef, targetCharacterId: number): void {
    const group = def.nonStackingGroup
    if (!group) return
    const conflicts = this.active.filter(
      (i) =>
        i.targetCharacterId === targetCharacterId &&
        i.def.id !== def.id &&
        i.def.nonStackingGroup === group,
    )
    if (conflicts.length === 0) return
    const ids = [def.id, ...conflicts.map((i) => i.def.id)].sort()
    console.info(
      `[BuffEngine] nonStackingGroup "${group}" has multiple co-active buffs on character ${targetCharacterId}: ${ids.join(", ")} (informational; v1 does not enforce caps)`,
    )
  }

  /**
   * Remove all active instances whose def.id is in `ids`. Emits buffConsumed for
   * each and returns the removed instances so the caller can fan out buffExpired.
   */
  removeBuffsById(
    ids: string[],
    frame: number,
    out: BuffEvent[],
  ): BuffInstance[] {
    const idSet = new Set(ids)
    const remaining: BuffInstance[] = []
    const removed: BuffInstance[] = []
    for (const inst of this.active) {
      if (idSet.has(inst.def.id)) {
        emit(out, inst.def, {
          kind: "buffConsumed",
          instanceId: inst.instanceId,
          buffId: inst.def.id,
          buffName: inst.def.name,
          sourceCharacterId: inst.sourceCharacterId,
          targetCharacterId: inst.targetCharacterId,
          frame,
          stacks: 0,
        })
        removed.push(inst)
      } else {
        remaining.push(inst)
      }
    }
    if (removed.length > 0) {
      this.active = remaining
      this.version_++
    }
    this.pauseGatedByRemoved(removed, frame)
    return removed
  }
}

export function matchesTrigger(
  trigger: Trigger,
  event: EngineEvent,
  sourceCharacterId: number,
): boolean {
  if (trigger.event === "simStart") return false

  // A `resourceStep` trigger matches a `resourceCrossed` event whose threshold
  // is a multiple of `step` in the mapped direction. Handled before the kind
  // check because the trigger kind differs from the event kind it consumes.
  if (trigger.event === "resourceStep" && event.kind === "resourceCrossed") {
    if (trigger.resource !== event.resource) return false
    const direction = trigger.direction === "gained" ? "up" : "down"
    if (direction !== event.direction) return false
    if (trigger.step <= 0 || event.threshold % trigger.step !== 0) return false
    if (trigger.actor !== "any" && sourceCharacterId !== event.characterId) {
      return false
    }
    if (
      trigger.characterId !== undefined &&
      trigger.characterId !== event.characterId
    ) {
      return false
    }
    return true
  }

  if (trigger.event !== event.kind) return false

  if (trigger.event === "skillCast" && event.kind === "skillCast") {
    if (trigger.actor !== "any" && sourceCharacterId !== event.characterId) {
      return false
    }
    if (
      trigger.characterId !== undefined &&
      trigger.characterId !== event.characterId
    ) {
      return false
    }
    if (!matchesAxis(trigger.skillCategory, event.skillCategory)) return false
    if (!matchesAxis(trigger.stageId, event.stageId)) return false
    if (!matchesAxis(trigger.skill, event.skill)) return false
    return true
  }

  if (
    (trigger.event === "swapIn" && event.kind === "swapIn") ||
    (trigger.event === "swapOut" && event.kind === "swapOut")
  ) {
    if (trigger.actor !== "any" && sourceCharacterId !== event.characterId) {
      return false
    }
    if (
      trigger.characterId !== undefined &&
      trigger.characterId !== event.characterId
    ) {
      return false
    }
    return true
  }

  if (trigger.event === "hitLanded" && event.kind === "hitLanded") {
    const isSynthetic = event.synthetic === true
    const source = trigger.source ?? "self"
    if (source === "self" && isSynthetic) return false
    if (source === "synthetic" && !isSynthetic) return false
    if (trigger.actor !== "any" && sourceCharacterId !== event.characterId) {
      return false
    }
    if (
      trigger.characterId !== undefined &&
      trigger.characterId !== event.characterId
    ) {
      return false
    }
    if (!matchesAxis(trigger.skillCategory, event.skillCategory)) return false
    if (trigger.dmgType && trigger.dmgType !== event.dmgType) {
      return false
    }
    if (!matchesAxis(trigger.stageId, event.stageId)) return false
    if (!matchesAxis(trigger.skill, event.skill)) return false
    if (!matchesAxis(trigger.hitIndex, event.hitIndex)) return false
    if (!matchesAxis(trigger.sourceBuff, event.sourceBuffId)) return false
    if (
      trigger.targetHasStatus &&
      !event.targetStatuses?.includes(trigger.targetHasStatus)
    ) {
      return false
    }
    return true
  }

  if (trigger.event === "healLanded" && event.kind === "healLanded") {
    if (trigger.actor !== "any" && sourceCharacterId !== event.characterId) {
      return false
    }
    if (
      trigger.characterId !== undefined &&
      trigger.characterId !== event.characterId
    ) {
      return false
    }
    if (!matchesAxis(trigger.skillCategory, event.skillCategory)) return false
    if (!matchesAxis(trigger.stageId, event.stageId)) return false
    if (!matchesAxis(trigger.skill, event.skill)) return false
    if (!matchesAxis(trigger.hitIndex, event.hitIndex)) return false
    return true
  }

  if (trigger.event === "resourceCrossed" && event.kind === "resourceCrossed") {
    if (trigger.resource !== event.resource) return false
    if (trigger.direction !== event.direction) return false
    if (trigger.threshold !== event.threshold) return false
    if (trigger.actor !== "any" && sourceCharacterId !== event.characterId) {
      return false
    }
    if (
      trigger.characterId !== undefined &&
      trigger.characterId !== event.characterId
    ) {
      return false
    }
    return true
  }

  if (
    trigger.event === "resourceConsumed" &&
    event.kind === "resourceConsumed"
  ) {
    if (trigger.resource !== event.resource) return false
    if (trigger.actor !== "any" && sourceCharacterId !== event.characterId) {
      return false
    }
    if (
      trigger.characterId !== undefined &&
      trigger.characterId !== event.characterId
    ) {
      return false
    }
    return true
  }

  if (trigger.event === "buffExpired" && event.kind === "buffExpired") {
    if (!matchesAxis(trigger.buff, event.buffId)) return false
    if (trigger.actor !== "any" && sourceCharacterId !== event.characterId) {
      return false
    }
    if (
      trigger.characterId !== undefined &&
      trigger.characterId !== event.characterId
    ) {
      return false
    }
    return true
  }

  if (
    trigger.event === "negStatusInflicted" &&
    event.kind === "negStatusInflicted"
  ) {
    if (trigger.status !== undefined && trigger.status !== event.status) {
      return false
    }
    if (trigger.actor !== "any" && sourceCharacterId !== event.characterId) {
      return false
    }
    if (
      trigger.characterId !== undefined &&
      trigger.characterId !== event.characterId
    ) {
      return false
    }
    return true
  }
  return false
}

/** Push a lifecycle event unless the buff is hidden (internal bookkeeping). */
function emit(out: BuffEvent[], def: BuffDef, event: BuffEvent): void {
  if (!def.hidden) out.push(event)
}

function stacksChanged(inst: BuffInstance, frame: number): BuffEvent {
  return {
    kind: "buffStacksChanged",
    instanceId: inst.instanceId,
    buffId: inst.def.id,
    buffName: inst.def.name,
    sourceCharacterId: inst.sourceCharacterId,
    targetCharacterId: inst.targetCharacterId,
    frame,
    stacks: inst.stacks,
  }
}

function computeEndTime(
  def: BuffDef,
  frame: number,
  targetCharacterId: number,
  getParentEndTime: (buffId: string, targetId: number) => number | undefined,
): number {
  if (def.duration == null) return frame
  switch (def.duration.kind) {
    case "permanent":
      return Number.POSITIVE_INFINITY
    case "frames":
      return frame + def.duration.v
    case "seconds":
      return frame + def.duration.v * 60
    case "inherit":
      return getParentEndTime(def.duration.buff, targetCharacterId) ?? frame
  }
}

/** Gating buff id of a suspendable duration, or undefined when ungated. */
function durationGate(def: BuffDef): string | undefined {
  const d = def.duration
  if (d && (d.kind === "frames" || d.kind === "seconds")) return d.while?.buff
  return undefined
}

/** Authored frame length of a timed duration (0 for non-timed kinds). */
function durationFrames(def: BuffDef): number {
  const d = def.duration
  if (d?.kind === "frames") return d.v
  if (d?.kind === "seconds") return d.v * 60
  return 0
}
