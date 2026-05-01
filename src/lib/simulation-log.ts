import type { DamageEntry } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type {
  ActionEvent,
  HitEvent,
  SimulationLogEntry,
} from "#/types/simulation-log"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById, getEchoById } from "./catalog"

interface ResolvedStage {
  concerto: number
  damage: DamageEntry[]
}

export function generateSimulationLog(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
): SimulationLogEntry[] {
  const log: SimulationLogEntry[] = []
  const energyByChar = new Map<number, number>()
  const concertoByChar = new Map<number, number>()
  let stageStartFrame = 0

  for (const entry of entries) {
    const character = getCharacterById(entry.characterId)
    if (!character) {
      stageStartFrame += entry.actionTime
      continue
    }

    const maxAtk = character.stats.max.atk
    const stage = resolveStage(entry, slots, loadouts)

    if (!stage) {
      stageStartFrame += entry.actionTime
      continue
    }

    const prevEnergy = energyByChar.get(entry.characterId) ?? 0
    const prevConcerto = concertoByChar.get(entry.characterId) ?? 0
    const actionCumConcerto = prevConcerto + stage.concerto
    concertoByChar.set(entry.characterId, actionCumConcerto)

    const actionEvent: ActionEvent = {
      kind: "action",
      characterId: entry.characterId,
      skillType: entry.skillType,
      skillName: entry.skillName,
      frame: stageStartFrame,
      cumulativeEnergy: prevEnergy,
      cumulativeConcerto: actionCumConcerto,
    }
    log.push(actionEvent)

    for (let i = 0; i < stage.damage.length; i++) {
      const hit = stage.damage[i]
      const cumEnergy = (energyByChar.get(entry.characterId) ?? 0) + hit.energy
      const cumConcerto =
        (concertoByChar.get(entry.characterId) ?? 0) + hit.concerto
      energyByChar.set(entry.characterId, cumEnergy)
      concertoByChar.set(entry.characterId, cumConcerto)

      const hitEvent: HitEvent = {
        kind: "hit",
        characterId: entry.characterId,
        skillType: entry.skillType,
        skillName: `${entry.skillName} [hit ${i + 1}]`,
        frame: stageStartFrame + hit.actionFrame,
        cumulativeEnergy: cumEnergy,
        cumulativeConcerto: cumConcerto,
        damage: Math.round(hit.value * maxAtk),
      }
      log.push(hitEvent)
    }

    stageStartFrame += entry.actionTime
  }

  return log
}

function resolveStage(
  entry: TimelineEntry,
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
    return { concerto: 0, damage: stage.damage }
  }

  const character = getCharacterById(entry.characterId)
  if (!character) return null

  for (const skill of character.skills) {
    if (skill.type !== entry.skillType) continue
    const stage = skill.stages.find(
      (s) => stageLabel(skill.name, s.newName) === entry.skillName,
    )
    if (stage && stage.damage) {
      return { concerto: stage.concerto ?? 0, damage: stage.damage }
    }
  }
  return null
}

function stageLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}
