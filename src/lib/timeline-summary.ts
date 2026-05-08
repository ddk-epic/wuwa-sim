import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById, getEchoById } from "#/lib/catalog"
import { resolveActionTime, type ActionTimeStage } from "./resolve-action-time"

const FRAMES_PER_SECOND = 60

const EMPTY_SLOTS: Slots = [null, null, null]
const EMPTY_LOADOUTS: SlotLoadout[] = []

export interface TimelineSummaryRow {
  time: number
  damage: number | null
}

export interface TimelineSummary {
  rows: TimelineSummaryRow[]
  totalDamage: number
  totalTimeSec: number
  dps: number
}

export function getTimelineSummary(
  entries: TimelineEntry[],
  slots: Slots = EMPTY_SLOTS,
  loadouts: SlotLoadout[] = EMPTY_LOADOUTS,
  reactionDelay: number = 9,
): TimelineSummary {
  const rows: TimelineSummaryRow[] = []
  let cumulativeFrames = 0
  let totalDamage = 0

  for (const entry of entries) {
    const time = cumulativeFrames / FRAMES_PER_SECOND
    let damage: number | null = null
    if (entry.multiplier > 0) {
      const maxAtk = getCharacterById(entry.characterId)?.stats.max.atk ?? 0
      damage = Math.round(entry.multiplier * maxAtk)
      totalDamage += damage
    }
    rows.push({ time, damage })

    const stage = findStageForEntry(entry, slots, loadouts)
    cumulativeFrames += stage
      ? resolveActionTime(stage, entry.variantKind, reactionDelay)
      : 0
  }

  const totalTimeSec = cumulativeFrames / FRAMES_PER_SECOND
  const dps = totalTimeSec > 0 ? Math.round(totalDamage / totalTimeSec) : 0

  return { rows, totalDamage, totalTimeSec, dps }
}

function stageLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}

function findStageForEntry(
  entry: TimelineEntry,
  slots: Slots,
  loadouts: SlotLoadout[],
): ActionTimeStage | null {
  if (entry.skillType === "Echo Skill") {
    const slotIndex = slots.findIndex((id) => id === entry.characterId)
    const echoId = slotIndex >= 0 ? (loadouts[slotIndex]?.echoId ?? null) : null
    const echo = echoId !== null ? getEchoById(echoId) : null
    if (!echo) return null
    return (
      echo.skill.stages.find(
        (s) => stageLabel(echo.name, s.newName) === entry.skillName,
      ) ?? null
    )
  }
  const character = getCharacterById(entry.characterId)
  if (!character) return null
  for (const skill of character.skills) {
    if (skill.type !== entry.skillType) continue
    const stage = skill.stages.find(
      (s) => stageLabel(skill.name, s.newName) === entry.skillName,
    )
    if (stage) return stage
  }
  return null
}
