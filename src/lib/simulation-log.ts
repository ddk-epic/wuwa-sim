import type { Slots, SlotLoadout } from "#/types/loadout"
import type {
  ActionEvent,
  BuffEvent,
  HitEvent,
  SimulationLogEntry,
  SustainEvent,
} from "#/types/simulation-log"
import type { HealTarget } from "#/types/character"
import type { TimelineEntry } from "#/types/timeline"
import { computeDamage } from "./compute-damage"
import { computeHealing } from "./compute-healing"
import { BuffEngine } from "./buff-engine"
import { findStageByEntry, resolveStageExecution } from "./stage"

export function generateSimulationLog(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
  reactionDelay: number = 9,
): SimulationLogEntry[] {
  const log: SimulationLogEntry[] = []
  const engine = new BuffEngine()
  engine.bootstrap({ slots, loadouts })
  let stageStartFrame = 0

  for (const entry of entries) {
    const resolved = findStageByEntry(entry, slots, loadouts)
    if (!resolved) continue

    const { duration: stageDuration, damage } = resolveStageExecution(
      resolved.stage,
      entry.variantKind,
      reactionDelay,
    )

    pushBuffEvents(log, engine.tickToFrame(stageStartFrame).lifecycleEvents)

    if (resolved.skillType !== "Movement") {
      const skillCastResult = engine.onEvent({
        kind: "skillCast",
        characterId: entry.characterId,
        skillType: resolved.skillType,
        stageId: resolved.stageId,
        frame: stageStartFrame,
        concerto: resolved.concerto,
        resonanceCost: resolved.resonanceCost,
      })
      pushBuffEvents(log, skillCastResult.lifecycleEvents)
      for (const synth of skillCastResult.syntheticHits) log.push(synth)
    }

    const actorState = engine.getResource(entry.characterId)
    const actionEvent: ActionEvent = {
      kind: "action",
      characterId: entry.characterId,
      skillType: resolved.skillType,
      skillName: resolved.skillName,
      frame: stageStartFrame,
      cumulativeEnergy: actorState.energy,
      cumulativeConcerto: actorState.concerto,
      variantKind: entry.variantKind,
    }
    log.push(actionEvent)

    for (let i = 0; i < damage.length; i++) {
      const hit = damage[i]
      const hitFrame = stageStartFrame + hit.actionFrame
      const hitResolved = engine.resolveHit(entry.characterId, hitFrame)
      pushBuffEvents(log, hitResolved.lifecycleEvents)

      if (hit.dmgType === "Heal") {
        const amount = computeHealing(
          {
            multiplier: hit.value,
            scalingStat: hit.scalingStat,
            flat: hit.flat,
          },
          hitResolved.stats,
        )

        const dispatch = engine.recordHeal({
          kind: "healLanded",
          characterId: entry.characterId,
          skillType: hit.type,
          frame: hitFrame,
          stageId: resolved.stageId,
          hitIndex: i + 1,
        })

        const sustainEvent: SustainEvent = {
          kind: "sustain",
          sub: "heal",
          characterId: entry.characterId,
          skillType: resolved.skillType,
          skillName: `${resolved.skillName} [heal ${i + 1}]`,
          frame: hitFrame,
          cumulativeEnergy: dispatch.postState.energy,
          cumulativeConcerto: dispatch.postState.concerto,
          amount,
          targets: resolveHealTargets(
            hit.target ?? "self",
            entry.characterId,
            slots,
          ),
          scalingStat: hit.scalingStat,
          multiplier: hit.value,
          flat: hit.flat,
          statsSnapshot: { ...hitResolved.stats },
          activeBuffs: hitResolved.activeBuffs,
          passiveBuffs: hitResolved.passiveBuffs,
        }
        log.push(sustainEvent)

        pushBuffEvents(log, dispatch.lifecycleEvents)
        for (const synth of dispatch.syntheticHits) log.push(synth)
      } else {
        const dmg = computeDamage(
          {
            multiplier: hit.value,
            element: resolved.element,
            skillType: resolved.skillType,
            dmgType: hit.dmgType,
            scalingStat: hit.scalingStat,
          },
          hitResolved.stats,
        )

        const dispatch = engine.recordHit({
          kind: "hitLanded",
          characterId: entry.characterId,
          skillType: hit.type,
          dmgType: hit.dmgType,
          frame: hitFrame,
          stageId: resolved.stageId,
          hitIndex: i + 1,
          energy: hit.energy,
          concerto: hit.concerto,
        })

        const hitEvent: HitEvent = {
          kind: "hit",
          characterId: entry.characterId,
          skillType: resolved.skillType,
          skillName: `${resolved.skillName} [hit ${i + 1}]`,
          frame: hitFrame,
          cumulativeEnergy: dispatch.postState.energy,
          cumulativeConcerto: dispatch.postState.concerto,
          damage: dmg,
          element: resolved.element,
          dmgType: hit.dmgType,
          scalingStat: hit.scalingStat,
          multiplier: hit.value,
          statsSnapshot: { ...hitResolved.stats },
          activeBuffs: hitResolved.activeBuffs,
          passiveBuffs: hitResolved.passiveBuffs,
        }
        log.push(hitEvent)

        pushBuffEvents(log, dispatch.lifecycleEvents)
        for (const synth of dispatch.syntheticHits) log.push(synth)
      }
    }

    stageStartFrame += stageDuration
  }

  return log
}

function pushBuffEvents(log: SimulationLogEntry[], events: BuffEvent[]): void {
  for (const e of events) log.push(e)
}

function resolveHealTargets(
  target: HealTarget,
  healerId: number,
  slots: Slots,
): number[] {
  switch (target) {
    case "self":
    case "source":
      return [healerId]
    case "currentOnField":
      return [healerId]
    case "team":
      return slots.filter((id) => id !== null) as number[]
    case "nextOnField":
      return []
  }
}
