import type {
  BuffDef,
  BuffInstance,
  Condition,
  ResourceEffect,
  ResourceKind,
  ResourceState,
  StackingPolicy,
  StatEffect,
  StatPath,
  Trigger,
  ValueExpr,
} from "#/types/buff"
import { emptyResourceState } from "#/types/buff"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { BuffEvent } from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import { emptyStatTable } from "#/types/stat-table"
import {
  getCharacterById,
  getEchoById,
  getEchoSetById,
  getWeaponById,
} from "./catalog"
import { compileSkillTreeNode } from "./skill-tree-registry"

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

  bootstrap(input: BootstrapInput): { lifecycleEvents: BuffEvent[] } {
    this.baseStats.clear()
    this.triggerableBySource.clear()
    this.active = []
    this.resources.clear()
    this.slotsBySlotIndex = []
    this.onFieldCharacterId = null
    this.pendingNextOnField = []

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
          for (let i = 0; i < buff.effects.length; i++) {
            const effect = buff.effects[i]
            if (effect.kind !== "stat") continue
            applyStatEffect(stats, effect, 1)
          }
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
  onEvent(event: EngineEvent): { lifecycleEvents: BuffEvent[] } {
    const lifecycleEvents: BuffEvent[] = []

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
          )
        }
        this.onFieldCharacterId = next
        this.dispatchEvent(
          { kind: "swapIn", characterId: next, frame: event.frame },
          lifecycleEvents,
        )
      }
    }

    this.dispatchEvent(event, lifecycleEvents)
    return { lifecycleEvents }
  }

  private dispatchEvent(event: EngineEvent, out: BuffEvent[]): void {
    // Resource phase (implicit): hit-driven and skill-cast-driven accumulation
    // happens before trigger matching so resourceCrossed triggers can chain.
    if (event.kind === "hitLanded") {
      if (event.energy) {
        this.applyResourceDelta(event.characterId, "energy", event.energy, out)
      }
      if (event.concerto) {
        this.applyResourceDelta(
          event.characterId,
          "concerto",
          event.concerto,
          out,
        )
      }
    }
    if (event.kind === "skillCast") {
      if (event.concerto) {
        this.applyResourceDelta(
          event.characterId,
          "concerto",
          event.concerto,
          out,
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
  }

  private applyResourceDelta(
    characterId: number,
    resource: ResourceKind,
    delta: number,
    out: BuffEvent[],
  ): void {
    const state = this.getResource(characterId)
    const before = state[resource]
    const after = before + delta
    state[resource] = after
    this.fireResourceCrossed(characterId, resource, before, after, out)
  }

  private setResource(
    characterId: number,
    resource: ResourceKind,
    value: number,
    out: BuffEvent[],
  ): void {
    const state = this.getResource(characterId)
    const before = state[resource]
    state[resource] = value
    this.fireResourceCrossed(characterId, resource, before, value, out)
  }

  private fireResourceCrossed(
    characterId: number,
    resource: ResourceKind,
    before: number,
    after: number,
    out: BuffEvent[],
  ): void {
    if (before === after) return
    const direction: "up" | "down" = after > before ? "up" : "down"
    const synthetic: EngineEvent = {
      kind: "resourceCrossed",
      characterId,
      resource,
      threshold: 0,
      direction,
      frame: 0,
    }
    // Match each resourceCrossed trigger that this delta crosses.
    for (const [sourceId, defs] of this.triggerableBySource) {
      for (const def of defs) {
        if (def.trigger.event !== "resourceCrossed") continue
        const t = def.trigger
        if (t.resource !== resource) continue
        if (t.direction !== direction) continue
        const crossed =
          direction === "up"
            ? before < t.threshold && after >= t.threshold
            : before > t.threshold && after <= t.threshold
        if (!crossed) continue
        if (t.actor !== "any" && sourceId !== characterId) continue
        if (t.characterId !== undefined && t.characterId !== characterId) {
          continue
        }
        // Fire as if a real event occurred. Re-route to apply path.
        const targetIds = resolveTargetIds(def, sourceId, this.slotsBySlotIndex)
        for (const targetId of targetIds) {
          this.applyBuff(def, sourceId, targetId, synthetic.frame, out)
        }
      }
    }
  }

  private applyResourceEffect(
    effect: ResourceEffect,
    sourceCharacterId: number,
    targetCharacterId: number,
    _frame: number,
    out: BuffEvent[],
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
      this.setResource(subjectId, effect.resource, after, out)
    } else {
      this.applyResourceDelta(subjectId, effect.resource, after - before, out)
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
      for (let i = 0; i < inst.def.effects.length; i++) {
        const effect = inst.def.effects[i]
        if (effect.kind !== "stat") continue
        applyStatEffect(base, effect, inst.stacks, inst.snapshots, i)
      }
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
      (i) => i.def.id === def.id && i.targetCharacterId === targetCharacterId,
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
        return
      }
    }
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

function resolveValue(
  value: ValueExpr,
  stacks: number,
  snapshots: Record<number, number> | undefined,
  effectIndex: number,
): number {
  if (value.snapshot && snapshots && snapshots[effectIndex] !== undefined) {
    return snapshots[effectIndex]
  }
  switch (value.kind) {
    case "const":
      return value.v
    case "perStack":
      return value.v * stacks
  }
}

function applyStatEffect(
  stats: StatTable,
  effect: StatEffect,
  stacks: number,
  snapshots?: Record<number, number>,
  effectIndex: number = 0,
): void {
  const v = resolveValue(effect.value, stacks, snapshots, effectIndex)
  applyToPath(stats, effect.path, v)
}

function freezeSnapshots(
  def: BuffDef,
  stacks: number,
): Record<number, number> | undefined {
  let out: Record<number, number> | undefined
  for (let i = 0; i < def.effects.length; i++) {
    const effect = def.effects[i]
    if (effect.kind !== "stat") continue
    if (!effect.value.snapshot) continue
    const frozen =
      effect.value.kind === "perStack"
        ? effect.value.v * stacks
        : effect.value.v
    if (!out) out = {}
    out[i] = frozen
  }
  return out
}

function applyToPath(stats: StatTable, path: StatPath, v: number): void {
  switch (path.stat) {
    case "atkBase":
    case "atkPct":
    case "atkFlat":
    case "critRate":
    case "critDmg":
    case "defShred":
      stats[path.stat] += v
      return
    case "elementBonus":
      stats.elementBonus[path.key] = (stats.elementBonus[path.key] ?? 0) + v
      return
    case "skillTypeBonus":
      stats.skillTypeBonus[path.key] = (stats.skillTypeBonus[path.key] ?? 0) + v
      return
    case "deepen":
      stats.deepen[path.key] = (stats.deepen[path.key] ?? 0) + v
      return
    case "resShred":
      stats.resShred[path.key] = (stats.resShred[path.key] ?? 0) + v
      return
  }
}
