import type {
  BuffDef,
  BuffInstance,
  StackingPolicy,
  StatEffect,
  StatPath,
  Trigger,
} from "#/types/buff"
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
    }
  | {
      kind: "hitLanded"
      characterId: number
      skillType: string
      dmgType: string
      synthetic?: boolean
      frame: number
    }

const DEFAULT_STACKING: StackingPolicy = { max: 1, onRetrigger: "refresh" }

export class BuffEngine {
  private baseStats = new Map<number, StatTable>()
  private slotsBySlotIndex: number[] = []
  /** Per-character pool of triggerable BuffDefs (pre-filtered by sequence/pieces). */
  private triggerableBySource = new Map<number, BuffDef[]>()
  private active: BuffInstance[] = []

  bootstrap(input: BootstrapInput): { lifecycleEvents: BuffEvent[] } {
    this.baseStats.clear()
    this.triggerableBySource.clear()
    this.active = []
    this.slotsBySlotIndex = []

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
        if (
          buff.trigger.event === "simStart" &&
          buff.duration.kind === "permanent"
        ) {
          for (const effect of buff.effects) {
            if (effect.kind !== "stat") continue
            applyStatEffect(stats, effect)
          }
        } else {
          triggerable.push(buff)
        }
      }

      this.baseStats.set(charId, stats)
      this.triggerableBySource.set(charId, triggerable)
    }
    return { lifecycleEvents: [] }
  }

  /** Process a triggering event; returns lifecycle events from any apply/refresh. */
  onEvent(event: EngineEvent): { lifecycleEvents: BuffEvent[] } {
    const lifecycleEvents: BuffEvent[] = []

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

    for (const { def, sourceCharacterId } of candidates) {
      const targetIds = resolveTargetIds(
        def,
        sourceCharacterId,
        this.slotsBySlotIndex,
      )
      for (const targetId of targetIds) {
        this.applyBuff(
          def,
          sourceCharacterId,
          targetId,
          event.frame,
          lifecycleEvents,
        )
      }
    }
    return { lifecycleEvents }
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
      for (const effect of inst.def.effects) {
        if (effect.kind !== "stat") continue
        applyStatEffect(base, effect)
      }
    }
    return base
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

function applyStatEffect(stats: StatTable, effect: StatEffect): void {
  if (effect.value.kind !== "const") return
  const v = effect.value.v
  applyToPath(stats, effect.path, v)
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
