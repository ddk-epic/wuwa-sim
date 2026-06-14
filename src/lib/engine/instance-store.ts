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
import { cloneStats, freezeSnapshots, matchesAxis } from "./stat-table-builder"

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
      /** Energy consumed on cast (Resonance Liberation only). Defaults to 100. */
      resonanceCost?: number
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
  private baseStats = new Map<number, StatTable>()
  private slotsBySlotIndex: number[] = []
  private version_ = 0
  private nextInstanceId = 0

  clear(): void {
    this.active = []
    this.triggerableBySource.clear()
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
  }

  appendTriggerable(characterId: number, defs: BuffDef[]): void {
    const existing = this.triggerableBySource.get(characterId) ?? []
    this.triggerableBySource.set(characterId, [...existing, ...defs])
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

  /** Drop instances whose source matches `sourceCharacterId` and that opt into expiry on swapOut. */
  expireOnSourceSwapOut(
    sourceCharacterId: number,
    frame: number,
    out: BuffEvent[],
  ): void {
    const remaining: BuffInstance[] = []
    for (const inst of this.active) {
      if (
        inst.def.expiresOnSourceSwapOut &&
        inst.sourceCharacterId === sourceCharacterId
      ) {
        out.push({
          kind: "buffExpired",
          instanceId: inst.instanceId,
          buffId: inst.def.id,
          buffName: inst.def.name,
          sourceCharacterId: inst.sourceCharacterId,
          targetCharacterId: inst.targetCharacterId,
          frame,
          stacks: inst.stacks,
        })
      } else {
        remaining.push(inst)
      }
    }
    if (remaining.length !== this.active.length) this.version_++
    this.active = remaining
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
        out.push({
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

  tickToFrame(frame: number): { lifecycleEvents: BuffEvent[] } {
    const lifecycleEvents: BuffEvent[] = []
    const remaining: BuffInstance[] = []
    for (const inst of this.active) {
      if (inst.endTime <= frame) {
        lifecycleEvents.push({
          kind: "buffExpired",
          instanceId: inst.instanceId,
          buffId: inst.def.id,
          buffName: inst.def.name,
          sourceCharacterId: inst.sourceCharacterId,
          targetCharacterId: inst.targetCharacterId,
          frame: inst.endTime,
          stacks: inst.stacks,
        })
      } else {
        remaining.push(inst)
      }
    }
    if (remaining.length !== this.active.length) this.version_++
    this.active = remaining
    return { lifecycleEvents }
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
        return this.active.find(
          (i) => i.def.id === buffId && i.targetCharacterId === targetId,
        )?.endTime
      },
    )

    if (!existing) {
      const isGlobal = targetCharacterId === GLOBAL_TARGET_ID
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
        // global is typed `?: true`; the assertion stops it widening to boolean.
        ...(isGlobal ? { global: true as const } : {}),
      })
      this.version_++
      out.push({
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

    switch (stacking.onRetrigger) {
      case "ignore":
        return
      case "refresh":
        existing.endTime = newEndTime
        existing.sourceCharacterId = sourceCharacterId
        this.version_++
        out.push({
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
      case "addStack":
        existing.stacks = Math.min(existing.stacks + 1, stacking.max)
        existing.endTime = newEndTime
        existing.sourceCharacterId = sourceCharacterId
        this.version_++
        out.push({
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
      case "addStackKeepTimer":
        existing.stacks = Math.min(existing.stacks + 1, stacking.max)
        this.version_++
        out.push({
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
      case "replace": {
        out.push({
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
        out.push({
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

  /** Remove all active instances whose def.id is in `ids`. Emits buffConsumed for each. */
  removeBuffsById(ids: string[], frame: number, out: BuffEvent[]): void {
    const idSet = new Set(ids)
    const remaining: BuffInstance[] = []
    let mutated = false
    for (const inst of this.active) {
      if (idSet.has(inst.def.id)) {
        out.push({
          kind: "buffConsumed",
          instanceId: inst.instanceId,
          buffId: inst.def.id,
          buffName: inst.def.name,
          sourceCharacterId: inst.sourceCharacterId,
          targetCharacterId: inst.targetCharacterId,
          frame,
          stacks: 0,
        })
        mutated = true
      } else {
        remaining.push(inst)
      }
    }
    if (mutated) {
      this.active = remaining
      this.version_++
    }
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
