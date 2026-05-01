import type { DamageEntry } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { SimulationLogEntry } from "#/types/simulation-log"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById, getEchoById } from "./catalog"

export function generateSimulationLog(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
): SimulationLogEntry[] {
  const log: SimulationLogEntry[] = []
  const energyByChar = new Map<number, number>()
  const concertoByChar = new Map<number, number>()

  for (const entry of entries) {
    const character = getCharacterById(entry.characterId)
    if (!character) continue

    const maxAtk = character.stats.max.atk
    const hits = resolveDamageEntries(entry, slots, loadouts)

    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i]
      const cumEnergy = (energyByChar.get(entry.characterId) ?? 0) + hit.energy
      const cumConcerto =
        (concertoByChar.get(entry.characterId) ?? 0) + hit.concerto
      energyByChar.set(entry.characterId, cumEnergy)
      concertoByChar.set(entry.characterId, cumConcerto)

      log.push({
        characterId: entry.characterId,
        skillType: entry.skillType,
        skillName: entry.skillName,
        hit: i + 1,
        damage: Math.round(hit.value * maxAtk),
        cumulativeEnergy: cumEnergy,
        cumulativeConcerto: cumConcerto,
      })
    }
  }

  return log
}

function resolveDamageEntries(
  entry: TimelineEntry,
  slots: Slots,
  loadouts: SlotLoadout[],
): DamageEntry[] {
  if (entry.skillType === "Echo Skill") {
    const slotIndex = slots.findIndex((id) => id === entry.characterId)
    const echoId = slotIndex >= 0 ? (loadouts[slotIndex]?.echoId ?? null) : null
    const echo = echoId !== null ? getEchoById(echoId) : null
    if (!echo) return []
    const stage = echo.skill.stages.find(
      (s) => stageLabel(echo.name, s.newName) === entry.skillName,
    )
    return stage?.damage ?? []
  }

  const character = getCharacterById(entry.characterId)
  if (!character) return []

  for (const skill of character.skills) {
    if (skill.type !== entry.skillType) continue
    const stage = skill.stages.find(
      (s) => stageLabel(skill.name, s.newName) === entry.skillName,
    )
    if (stage?.damage) return stage.damage
  }
  return []
}

function stageLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}
