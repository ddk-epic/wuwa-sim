import type { DamageEntry, EnrichedCharacter } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type {
  ActionEvent,
  HitEvent,
  SimulationLogEntry,
} from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById, getEchoById } from "./catalog"
import { computeDamage } from "./compute-damage"
import { emptyStatTable } from "#/types/stat-table"

interface ResolvedStage {
  concerto: number
  damage: DamageEntry[]
  element: string
}

export function generateSimulationLog(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
): SimulationLogEntry[] {
  const log: SimulationLogEntry[] = []
  const energyByChar = new Map<number, number>()
  const concertoByChar = new Map<number, number>()
  const statsByChar = new Map<number, StatTable>()
  let stageStartFrame = 0

  for (const entry of entries) {
    const character = getCharacterById(entry.characterId)
    if (!character) {
      stageStartFrame += entry.actionTime
      continue
    }

    const stage = resolveStage(entry, character, slots, loadouts)

    if (!stage) {
      stageStartFrame += entry.actionTime
      continue
    }

    const stats = getOrBuildStats(character, statsByChar)

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

      const damage = computeDamage(
        {
          multiplier: hit.value,
          element: stage.element,
          skillType: entry.skillType,
          dmgType: hit.dmgType,
        },
        stats,
      )

      const hitEvent: HitEvent = {
        kind: "hit",
        characterId: entry.characterId,
        skillType: entry.skillType,
        skillName: `${entry.skillName} [hit ${i + 1}]`,
        frame: stageStartFrame + hit.actionFrame,
        cumulativeEnergy: cumEnergy,
        cumulativeConcerto: cumConcerto,
        damage,
      }
      log.push(hitEvent)
    }

    stageStartFrame += entry.actionTime
  }

  return log
}

function getOrBuildStats(
  character: EnrichedCharacter,
  cache: Map<number, StatTable>,
): StatTable {
  const cached = cache.get(character.id)
  if (cached) return cached
  const stats: StatTable = {
    ...emptyStatTable(),
    atkBase: character.stats.max.atk,
  }
  cache.set(character.id, stats)
  return stats
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
    return { concerto: 0, damage: stage.damage, element: echo.element }
  }

  for (const skill of character.skills) {
    if (skill.type !== entry.skillType) continue
    const stage = skill.stages.find(
      (s) => stageLabel(skill.name, s.newName) === entry.skillName,
    )
    if (stage && stage.damage) {
      return {
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
