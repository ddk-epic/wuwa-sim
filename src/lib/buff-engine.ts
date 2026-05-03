import type {
  BuffDef,
  BuffInstance,
  Condition,
  EmitHitEffect,
  ResourceEffect,
  ResourceKind,
  ResourceState,
  StackingPolicy,
  Trigger,
} from "#/types/buff"
import { emptyResourceState } from "#/types/buff"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { BuffEvent, HitEvent } from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import { emptyStatTable } from "#/types/stat-table"
import {
  getCharacterById,
  getEchoById,
  getEchoSetById,
  getWeaponById,
} from "./catalog"
import { computeDamage } from "./compute-damage"
import { compileSkillTreeNode } from "./skill-tree-registry"
import { accumulateStatEffects, freezeSnapshots } from "./stat-table-builder"

export interface BootstrapInput {
  slots: Slots
  loadouts: SlotLoadout[]
  /** Per-slot resonance chain sequence (0..6). Defaults to 6 for each slot. */
  sequences?: (number | undefined)[]
  /** Per-slot equipped echo set piece count (0, 2, or 5). Defaults to 5. */
  echoSetPieces?: (number | undefined)[]
}

export type EngineEvent =
  | {
      kind: "skillCast"
      characterId: number
      skillType: string
      frame: number
      /** Stage-level concerto attached to this cast (action-level). */
      concerto?: number
    }
  | {
      kind: "hitLanded"
      characterId: number
      skillType: string
      dmgType: string
      synthetic?: boolean
      frame: number
      /** Per-hit energy gained by the actor. Implicit `resource` effect. */
      energy?: number
      /** Per-hit concerto gained by the actor. Implicit `resource` effect. */
      concerto?: number
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

const DEFAULT_STACKING: StackingPolicy = { max: 1, onRetrigger: "refresh" }
const EMIT_HIT_CHAIN_DEPTH_CAP = 8

export class BuffEngine {
  private baseStats = new Map<number, StatTable>()
  private slotsBySlotIndex: number[] = []
  /** Per-character pool of triggerable BuffDefs (pre-filtered by sequence/pieces). */
  private triggerableBySource = new Map<number, BuffDef[]>()
  private active: BuffInstance[] = []
  private resources = new Map<number, ResourceState>()
  private onFieldCharacterId: number | null = null
  private pendingNextOnField: {
    def: BuffDef
    sourceCharacterId: number
    appliedFrame: number
  }[] = []
  /** Per-emitHit ICD timer keyed by `${buffDefId}|${effectIndex}|${sourceId}`. */
  private icdLastFired = new Map<string, number>()

  bootstrap(input: BootstrapInput): { lifecycleEvents: BuffEvent[] } {
    this.baseStats.clear()
    this.triggerableBySource.clear()
    this.active = []
    this.resources.clear()
    this.slotsBySlotIndex = []
    this.onFieldCharacterId = null
    this.pendingNextOnField = []
    this.icdLastFired.clear()

    for (let i = 0; i < input.slots.length; i++) {
      const charId = input.slots[i]
      this.slotsBySlotIndex.push(charId ?? -1)
      if (charId === null) continue
      const character = getCharacterById(charId)
      if (!character) continue

      const sequence = input.sequences?.[i] ?? 6
      const pieces = input.echoSetPieces?.[i] ?? 5
      const loadout = input.loadouts[i] ?? null

      const stats: StatTable = {
        ...emptyStatTable(),
        atkBase: character.stats.max.atk,
      }

      const buffs: BuffDef[] = []

      for (const def of character.buffs) {
        if ((def.requiresSequence ?? 0) <= sequence) buffs.push(def)
      }

      for (const nodeName of character.skillTreeBonuses) {
        const def = compileSkillTreeNode(nodeName, {
          characterId: character.id,
          characterElement: character.element,
        })
        if (def) buffs.push(def)
      }

      const weaponId = loadout?.weaponId ?? null
      if (weaponId !== null) {
        const weapon = getWeaponById(weaponId)
        if (weapon) {
          applyWeaponIntrinsic(
            stats,
            weapon.stats.main.max,
            weapon.stats.main.name,
          )
          applyWeaponIntrinsic(
            stats,
            weapon.stats.sub.max,
            weapon.stats.sub.name,
          )
          buffs.push(...weapon.buffs)
        }
      }

      const echoId = loadout?.echoId ?? null
      if (echoId !== null) {
        const echo = getEchoById(echoId)
        if (echo) buffs.push(...echo.buffs)
      }

      const echoSetId = loadout?.echoSetId ?? null
      if (echoSetId !== null) {
        const echoSet = getEchoSetById(echoSetId)
        if (echoSet) {
          for (const def of echoSet.buffs) {
            if ((def.requiresPieces ?? 2) <= pieces) buffs.push(def)
          }
        }
      }

      buffs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

      const triggerable: BuffDef[] = []
      for (const buff of buffs) {
        const isPermanentSimStart =
          buff.trigger.event === "simStart" &&
          buff.duration.kind === "permanent"
        if (isPermanentSimStart && !buff.condition) {
          accumulateStatEffects(stats, { def: buff, stacks: 1 })
        } else if (isPermanentSimStart && buff.condition) {
          this.active.push({
            def: buff,
            sourceCharacterId: charId,
            targetCharacterId: charId,
            endTime: Number.POSITIVE_INFINITY,
            stacks: 1,
            appliedFrame: 0,
            snapshots: freezeSnapshots(buff, 1),
          })
        } else {
          triggerable.push(buff)
        }
      }

      this.baseStats.set(charId, stats)
      this.triggerableBySource.set(charId, triggerable)
      this.resources.set(charId, emptyResourceState())
    }
    return { lifecycleEvents: [] }
  }

  getResource(characterId: number): ResourceState {
    let state = this.resources.get(characterId)
    if (!state) {
      state = emptyResourceState()
      this.resources.set(characterId, state)
    }
    return state
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
      const next = event.characterId
      if (this.onFieldCharacterId !== next) {
        const prev = this.onFieldCharacterId
        if (prev !== null) {
          this.dispatchEvent(
            { kind: "swapOut", characterId: prev, frame: event.frame },
            lifecycleEvents,
            syntheticHits,
            0,
          )
        }
        this.onFieldCharacterId = next
        this.dispatchEvent(
          { kind: "swapIn", characterId: next, frame: event.frame },
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
        this.applyResourceDelta(
          event.characterId,
          "energy",
          event.energy,
          event.frame,
          out,
          hitsOut,
          depth,
        )
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

    // swapOut: cleanup expiresOnSourceSwapOut instances
    if (event.kind === "swapOut") {
      const remaining: BuffInstance[] = []
      for (const inst of this.active) {
        if (
          inst.def.expiresOnSourceSwapOut &&
          inst.sourceCharacterId === event.characterId
        ) {
          out.push({
            kind: "buffExpired",
            buffId: inst.def.id,
            buffName: inst.def.name,
            sourceCharacterId: inst.sourceCharacterId,
            targetCharacterId: inst.targetCharacterId,
            frame: event.frame,
            stacks: inst.stacks,
          })
        } else {
          remaining.push(inst)
        }
      }
      this.active = remaining
    }

    // swapIn: materialize pending nextOnField buffs onto the new on-field char
    if (event.kind === "swapIn" && this.pendingNextOnField.length > 0) {
      const pending = this.pendingNextOnField
      this.pendingNextOnField = []
      pending.sort((a, b) =>
        a.def.id < b.def.id ? -1 : a.def.id > b.def.id ? 1 : 0,
      )
      for (const p of pending) {
        this.applyBuff(
          p.def,
          p.sourceCharacterId,
          event.characterId,
          event.frame,
          out,
        )
      }
    }

    // Run trigger matching
    const candidates: { def: BuffDef; sourceCharacterId: number }[] = []
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

    // Phase: resource — fire explicit resource effects from triggered buffs
    // before stat-effect application (which is deferred to resolveStats).
    for (const { def, sourceCharacterId } of candidates) {
      for (const effect of def.effects) {
        if (effect.kind !== "resource") continue
        const targets = resolveTargetIds(
          def,
          sourceCharacterId,
          this.slotsBySlotIndex,
        )
        for (const targetId of targets) {
          this.applyResourceEffect(
            effect,
            sourceCharacterId,
            targetId,
            event.frame,
            out,
            hitsOut,
            depth,
          )
        }
      }
    }

    // Phase: stat — apply buffs (instances accumulate stat effects via resolveStats).
    for (const { def, sourceCharacterId } of candidates) {
      if (def.target.kind === "nextOnField") {
        this.pendingNextOnField.push({
          def,
          sourceCharacterId,
          appliedFrame: event.frame,
        })
        continue
      }
      const targetIds = resolveTargetIds(
        def,
        sourceCharacterId,
        this.slotsBySlotIndex,
      )
      for (const targetId of targetIds) {
        this.applyBuff(def, sourceCharacterId, targetId, event.frame, out)
      }
    }

    // Phase: emitHit — fire synthetic hits subject to per-instance ICDs.
    // Lex tiebreak by buffDef.id is preserved (candidates already sorted).
    for (const { def, sourceCharacterId } of candidates) {
      for (let i = 0; i < def.effects.length; i++) {
        const effect = def.effects[i]
        if (effect.kind !== "emitHit") continue
        this.fireEmitHit(
          def,
          effect,
          i,
          sourceCharacterId,
          event.frame,
          out,
          hitsOut,
          depth,
        )
      }
    }

    // Phase: consume — implicit fifth phase. Walk active instances and
    // decrement stacks for any whose consumedBy filter matches the just-fired
    // event. Removed (stacks==0) instances emit buffConsumed.
    this.runConsumePhase(event, out)
  }

  private runConsumePhase(event: EngineEvent, out: BuffEvent[]): void {
    const remaining: BuffInstance[] = []
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
          buffId: inst.def.id,
          buffName: inst.def.name,
          sourceCharacterId: inst.sourceCharacterId,
          targetCharacterId: inst.targetCharacterId,
          frame: event.frame,
          stacks: 0,
        })
      } else {
        inst.stacks = next
        remaining.push(inst)
      }
    }
    this.active = remaining
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
    const icdKey = `${def.id}|${effectIndex}|${sourceCharacterId}`
    const last = this.icdLastFired.get(icdKey)
    if (last !== undefined && frame - last < effect.icdFrames) return

    if (depth + 1 > EMIT_HIT_CHAIN_DEPTH_CAP) {
      console.warn(
        `[BuffEngine] emitHit chain depth exceeded ${EMIT_HIT_CHAIN_DEPTH_CAP} (buff: ${def.id}, source: ${sourceCharacterId}); stopping chain`,
      )
      return
    }
    this.icdLastFired.set(icdKey, frame)

    const stats = this.resolveStats(sourceCharacterId)
    const character = getCharacterById(sourceCharacterId)
    const element = effect.element ?? character?.element ?? ""
    const skillType = effect.skillType ?? "Coordinated Attack"
    const damage = computeDamage(
      {
        multiplier: effect.damage.value,
        element,
        skillType,
        dmgType: effect.damage.dmgType,
      },
      stats,
    )

    if (effect.damage.energy) {
      this.applyResourceDelta(
        sourceCharacterId,
        "energy",
        effect.damage.energy,
        frame,
        out,
        hitsOut,
        depth,
      )
    }
    if (effect.damage.concerto) {
      this.applyResourceDelta(
        sourceCharacterId,
        "concerto",
        effect.damage.concerto,
        frame,
        out,
        hitsOut,
        depth,
      )
    }
    const post = this.getResource(sourceCharacterId)

    hitsOut.push({
      kind: "hit",
      synthetic: true,
      sourceBuffId: def.id,
      characterId: sourceCharacterId,
      skillType,
      skillName: def.name,
      frame,
      cumulativeEnergy: post.energy,
      cumulativeConcerto: post.concerto,
      damage,
      statsSnapshot: cloneStats(stats),
      activeBuffIds: this.activeBuffIds(sourceCharacterId),
    })

    // Chain: each synthetic hit fires its own hitLanded event subject to
    // per-instance ICDs. Energy/concerto already applied above; pass 0 so
    // the recursive dispatch's resource phase does not double-count.
    this.dispatchEvent(
      {
        kind: "hitLanded",
        characterId: sourceCharacterId,
        skillType,
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
    const state = this.getResource(characterId)
    const before = state[resource]
    const after = before + delta
    state[resource] = after
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
    const state = this.getResource(characterId)
    const before = state[resource]
    state[resource] = value
    this.fireResourceCrossed(
      characterId,
      resource,
      before,
      value,
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
    // Discover the set of unique thresholds crossed by this delta from
    // registered triggers, then dispatch one synthetic resourceCrossed event
    // per crossing through the main pipeline. This is the single home for
    // resourceCrossed matching: matchesTrigger + dispatchEvent take it from here.
    const crossedThresholds = new Set<number>()
    for (const defs of this.triggerableBySource.values()) {
      for (const def of defs) {
        const t = def.trigger
        if (t.event !== "resourceCrossed") continue
        if (t.resource !== resource) continue
        if (t.direction !== direction) continue
        const crossed =
          direction === "up"
            ? before < t.threshold && after >= t.threshold
            : before > t.threshold && after <= t.threshold
        if (crossed) crossedThresholds.add(t.threshold)
      }
    }
    if (crossedThresholds.size === 0) return
    const sortedThresholds = Array.from(crossedThresholds).sort((a, b) =>
      direction === "up" ? a - b : b - a,
    )
    for (const threshold of sortedThresholds) {
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
    const state = this.getResource(subjectId)
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
    const lifecycleEvents: BuffEvent[] = []
    const remaining: BuffInstance[] = []
    for (const inst of this.active) {
      if (inst.endTime <= frame) {
        lifecycleEvents.push({
          kind: "buffExpired",
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
    this.active = remaining
    return { lifecycleEvents }
  }

  resolveStats(characterId: number): StatTable {
    const cached = this.baseStats.get(characterId)
    const base = cached
      ? cloneStats(cached)
      : (() => {
          const character = getCharacterById(characterId)
          return {
            ...emptyStatTable(),
            atkBase: character ? character.stats.max.atk : 0,
          }
        })()

    const contributions = this.active
      .filter((inst) => inst.targetCharacterId === characterId)
      .sort((a, b) => (a.def.id < b.def.id ? -1 : a.def.id > b.def.id ? 1 : 0))

    for (const inst of contributions) {
      if (
        inst.def.condition &&
        !this.evaluateCondition(inst.def.condition, inst)
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

  private evaluateCondition(cond: Condition, inst: BuffInstance): boolean {
    switch (cond.kind) {
      case "buffActive": {
        const subjectId =
          cond.on === "source" ? inst.sourceCharacterId : inst.targetCharacterId
        return this.active.some(
          (i) => i.def.id === cond.buffId && i.targetCharacterId === subjectId,
        )
      }
      case "onField":
        return this.onFieldCharacterId === inst.targetCharacterId
      case "actorIsOnField":
        return this.onFieldCharacterId === inst.sourceCharacterId
      case "resourceAtLeast": {
        const subjectId =
          cond.on === "source" ? inst.sourceCharacterId : inst.targetCharacterId
        return this.getResource(subjectId)[cond.resource] >= cond.n
      }
    }
  }

  /** Test/inspection helper. */
  getOnFieldCharacterId(): number | null {
    return this.onFieldCharacterId
  }

  /** Test/inspection helper for pending nextOnField count. */
  pendingNextOnFieldCount(): number {
    return this.pendingNextOnField.length
  }

  /** Sorted ids of buff instances currently active on `characterId`. */
  activeBuffIds(characterId: number): string[] {
    return this.active
      .filter((inst) => inst.targetCharacterId === characterId)
      .map((inst) => inst.def.id)
      .sort()
  }

  private applyBuff(
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
    const newEndTime = computeEndTime(def, frame)

    if (!existing) {
      this.active.push({
        def,
        sourceCharacterId,
        targetCharacterId,
        endTime: newEndTime,
        stacks: 1,
        appliedFrame: frame,
        snapshots: freezeSnapshots(def, 1),
      })
      out.push({
        kind: "buffApplied",
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
        out.push({
          kind: "buffRefreshed",
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
        out.push({
          kind: "buffRefreshed",
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
        out.push({
          kind: "buffRefreshed",
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
          buffId: def.id,
          buffName: def.name,
          sourceCharacterId: existing.sourceCharacterId,
          targetCharacterId,
          frame,
          stacks: existing.stacks,
        })
        this.active = this.active.filter((i) => i !== existing)
        this.active.push({
          def,
          sourceCharacterId,
          targetCharacterId,
          endTime: newEndTime,
          stacks: 1,
          appliedFrame: frame,
          snapshots: freezeSnapshots(def, 1),
        })
        out.push({
          kind: "buffApplied",
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
}

function matchesTrigger(
  trigger: Trigger,
  event: EngineEvent,
  sourceCharacterId: number,
): boolean {
  if (trigger.event === "simStart") return false
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
    if (trigger.skillType && trigger.skillType !== event.skillType) {
      return false
    }
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
    if (trigger.skillType && trigger.skillType !== event.skillType) {
      return false
    }
    if (trigger.dmgType && trigger.dmgType !== event.dmgType) {
      return false
    }
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
  return false
}

function resolveTargetIds(
  def: BuffDef,
  sourceCharacterId: number,
  slots: number[],
): number[] {
  switch (def.target.kind) {
    case "self":
      return [sourceCharacterId]
    case "team":
      return slots.filter((id) => id !== -1)
    case "nextOnField":
      return []
  }
}

function computeEndTime(def: BuffDef, frame: number): number {
  switch (def.duration.kind) {
    case "permanent":
      return Number.POSITIVE_INFINITY
    case "frames":
      return frame + def.duration.v
    case "seconds":
      return frame + def.duration.v * 60
  }
}

function cloneStats(s: StatTable): StatTable {
  return {
    atkBase: s.atkBase,
    atkPct: s.atkPct,
    atkFlat: s.atkFlat,
    critRate: s.critRate,
    critDmg: s.critDmg,
    defShred: s.defShred,
    elementBonus: { ...s.elementBonus },
    skillTypeBonus: { ...s.skillTypeBonus },
    deepen: { ...s.deepen },
    resShred: { ...s.resShred },
  }
}

function applyWeaponIntrinsic(
  stats: StatTable,
  value: number,
  statName: string,
): void {
  switch (statName) {
    case "ATK":
      stats.atkBase += value
      return
    case "Crit. Rate":
      stats.critRate += value
      return
    case "Crit. DMG":
      stats.critDmg += value
      return
  }
}
