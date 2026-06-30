import type { BuffDef, BuffInstance } from "#/types/buff"
import type { SlotLoadout } from "#/types/loadout"
import type { StatTable } from "#/types/stat-table"
import { resolveSlot } from "./loadout/resolve-slot"
import {
  accumulateStatEffects,
  freezeSnapshots,
} from "./engine/apply-stat-effects"

export interface SlotBootstrap {
  charId: number
  baseStats: StatTable
  triggerable: BuffDef[]
  permanentInstances: Omit<BuffInstance, "instanceId">[]
  foldedBuffs: BuffDef[]
}

/** Load-time validator for BuffDef structural invariants. Throws on violation. */
export function validateBuffDef(def: BuffDef): void {
  const hasTarget = def.target != null
  const hasDuration = def.duration != null
  if (hasTarget !== hasDuration) {
    throw new Error(
      `BuffDef "${def.id}": target and duration must both be present (stateful) or both absent (reaction).`,
    )
  }
  if (!hasDuration) {
    if (def.effects.some((e) => e.kind === "stat")) {
      throw new Error(
        `BuffDef "${def.id}": reaction-shaped BuffDef cannot have stat effects.`,
      )
    }
    if (def.stacking) {
      throw new Error(
        `BuffDef "${def.id}": reaction-shaped BuffDef cannot declare stacking.`,
      )
    }
    if (def.consumedBy) {
      throw new Error(
        `BuffDef "${def.id}": reaction-shaped BuffDef cannot declare consumedBy.`,
      )
    }
    if (def.condition != null) {
      throw new Error(
        `BuffDef "${def.id}": reaction-shaped BuffDef cannot carry a root condition; gate it with trigger.precondition.`,
      )
    }
  }
  if (def.target?.kind === "global") {
    if (def.condition != null) {
      const c = def.condition
      if (
        (c.kind === "buffActive" && c.on === "target") ||
        c.kind === "onField" ||
        (c.kind === "resourceAtLeast" && c.on === "target")
      ) {
        throw new Error(
          `BuffDef "${def.id}": global buff condition must not reference the reader (on:"target" or onField).`,
        )
      }
    }
  }
}

/**
 * Seed a single slot's engine state: resolve its base stats + BuffDefs, then
 * partition the defs into folded permanents (into the base table), permanent
 * sim-start instances (those needing a runtime gate), and triggerables.
 */
export function bootstrapSlot(
  charId: number,
  loadout: SlotLoadout | null,
): SlotBootstrap | null {
  const resolved = resolveSlot(charId, loadout)
  if (!resolved) return null
  const { baseStats: stats, buffDefs: buffs } = resolved

  for (const buff of buffs) validateBuffDef(buff)

  const triggerable: BuffDef[] = []
  const permanentInstances: Omit<BuffInstance, "instanceId">[] = []
  const foldedBuffs: BuffDef[] = []
  for (const buff of buffs) {
    // self wielder-id filter: the source is always this slot's char, so a
    // self-target whose characterId list excludes charId never lands — skip it
    // (no fold, no instance, no triggerable registration).
    const target = buff.target
    if (target?.kind === "self" && target.characterId != null) {
      const allowed = Array.isArray(target.characterId)
        ? target.characterId
        : [target.characterId]
      if (!allowed.includes(charId)) continue
    }
    const isPermanentSimStart =
      buff.trigger.event === "simStart" && buff.duration?.kind === "permanent"
    // A hit-scoped (`appliesToHits`) buff must stay a runtime instance: its
    // effects are gated per-hit at resolveStats time, so folding would leak the
    // bonus onto every hit.
    const needsInstance = buff.condition != null || buff.appliesToHits != null
    if (isPermanentSimStart && !needsInstance) {
      accumulateStatEffects(stats, { def: buff, stacks: 1 })
      foldedBuffs.push(buff)
    } else if (isPermanentSimStart && needsInstance) {
      permanentInstances.push({
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

  return {
    charId,
    baseStats: stats,
    triggerable,
    permanentInstances,
    foldedBuffs,
  }
}
