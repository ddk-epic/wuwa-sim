import type { DamageEntry, EnrichedCharacter } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type {
  ActionEvent,
  BuffEvent,
  HitEvent,
  SimulationLogEntry,
} from "#/types/simulation-log"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById, getEchoById } from "./catalog"
import { computeDamage } from "./compute-damage"
import { BuffEngine } from "./buff-engine"
import { resolveActionTime } from "./resolve-action-time"
import type { ActionTimeStage } from "./resolve-action-time"

interface ResolvedStage {
  stage: ActionTimeStage
  concerto: number
  damage: DamageEntry[]
  element: string
}

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
    const character = getCharacterById(entry.characterId)
    if (!character) continue

    const resolved = resolveStage(entry, character, slots, loadouts)
    if (!resolved) continue

    const stageDuration = resolveActionTime(
      resolved.stage,
      entry.variantKind,
      reactionDelay,
    )

    const variantCutoff =
      entry.variantKind !== undefined &&
      resolved.stage.variants?.[entry.variantKind]
        ? resolved.stage.variants[entry.variantKind]!.actionTime + reactionDelay
        : undefined

    const damage =
      variantCutoff !== undefined
        ? resolved.damage.filter((hit) => hit.actionFrame <= variantCutoff)
        : resolved.damage

    pushBuffEvents(log, engine.tickToFrame(stageStartFrame).lifecycleEvents)
    const skillCastResult = engine.onEvent({
      kind: "skillCast",
      characterId: entry.characterId,
      skillType: entry.skillType,
      frame: stageStartFrame,
      concerto: resolved.concerto,
    })
    pushBuffEvents(log, skillCastResult.lifecycleEvents)
    for (const synth of skillCastResult.syntheticHits) log.push(synth)

    const actorState = engine.getResource(entry.characterId)
    const actionEvent: ActionEvent = {
      kind: "action",
      characterId: entry.characterId,
      skillType: entry.skillType,
      skillName: entry.skillName,
      frame: stageStartFrame,
      cumulativeEnergy: actorState.energy,
      cumulativeConcerto: actorState.concerto,
      variantKind: entry.variantKind,
    }
    log.push(actionEvent)

    for (let i = 0; i < damage.length; i++) {
      const hit = damage[i]
      const hitFrame = stageStartFrame + hit.actionFrame
      const hitResolved = engine.resolveHit(character.id, hitFrame)
      pushBuffEvents(log, hitResolved.lifecycleEvents)

      const dmg = computeDamage(
        {
          multiplier: hit.value,
          element: resolved.element,
          skillType: entry.skillType,
          dmgType: hit.dmgType,
          scalingStat: hit.scalingStat,
        },
        hitResolved.stats,
      )

      const dispatch = engine.recordHit({
        kind: "hitLanded",
        characterId: entry.characterId,
        skillType: entry.skillType,
        dmgType: hit.dmgType,
        frame: hitFrame,
        energy: hit.energy,
        concerto: hit.concerto,
      })

      const hitEvent: HitEvent = {
        kind: "hit",
        characterId: entry.characterId,
        skillType: entry.skillType,
        skillName: `${entry.skillName} [hit ${i + 1}]`,
        frame: hitFrame,
        cumulativeEnergy: dispatch.postState.energy,
        cumulativeConcerto: dispatch.postState.concerto,
        damage: dmg,
        statsSnapshot: { ...hitResolved.stats },
        activeBuffIds: hitResolved.activeBuffIds,
      }
      log.push(hitEvent)

      pushBuffEvents(log, dispatch.lifecycleEvents)
      for (const synth of dispatch.syntheticHits) log.push(synth)
    }

    stageStartFrame += stageDuration
  }

  return log
}

function pushBuffEvents(log: SimulationLogEntry[], events: BuffEvent[]): void {
  for (const e of events) log.push(e)
}

function resolveStage(
  entry: TimelineEntry,
  character: EnrichedCharacter,
  slots: Slots,
  loadouts: SlotLoadout[],
): ResolvedStage | null {
  if (entry.skillType === "Echo Skill") {
    const slotIndex = slots.findIndex((id) => id === entry.characterId)
    const echoId = slotIndex >= 0 ? (loadouts[slotIndex]?.echoId ?? null) : null
    const echo = echoId !== null ? getEchoById(echoId) : null
    if (!echo) return null
    const stage = echo.skill.stages.find(
      (s) => stageLabel(echo.name, s.newName) === entry.skillName,
    )
    if (!stage) return null
    return { stage, concerto: 0, damage: stage.damage, element: echo.element }
  }

  for (const skill of character.skills) {
    if (skill.type !== entry.skillType) continue
    const stage = skill.stages.find(
      (s) => stageLabel(skill.name, s.newName) === entry.skillName,
    )
    if (stage?.damage) {
      return {
        stage,
        concerto: stage.concerto ?? 0,
        damage: stage.damage,
        element: character.element,
      }
    }
  }
  return null
}

function stageLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}
