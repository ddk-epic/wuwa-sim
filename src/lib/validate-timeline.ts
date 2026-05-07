import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById, getEchoById } from "./catalog"

export interface ValidationError {
  message: string
}

export interface ValidationResult {
  rowErrors: Map<string, ValidationError[]>
  invalidRowIds: Set<string>
}

function stageLabel(skillName: string, newName?: string): string {
  if (!newName) return skillName
  if (newName.startsWith("(")) return `${skillName} ${newName}`
  return `${skillName} · ${newName}`
}

export function validateTimeline(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
): ValidationResult {
  const rowErrors = new Map<string, ValidationError[]>()
  const invalidRowIds = new Set<string>()

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const errors: ValidationError[] = []

    if (entry.skillType === "Intro Skill") {
      const prev = i > 0 ? entries[i - 1] : null
      if (prev?.skillType !== "Outro Skill") {
        errors.push({
          message: "Intro Skill must immediately follow an Outro Skill",
        })
      }
    }

    const slotIndex = slots.indexOf(entry.characterId)
    if (slotIndex === -1) {
      errors.push({ message: "Character is not in the team" })
    } else {
      if (entry.skillType === "Echo Skill") {
        const echoId = loadouts[slotIndex]?.echoId ?? null
        const echo = echoId !== null ? getEchoById(echoId) : null
        if (!echo) {
          errors.push({ message: "No echo equipped for this slot" })
        } else {
          const found = echo.skill.stages.some(
            (s) => stageLabel(echo.name, s.newName) === entry.skillName,
          )
          if (!found) {
            errors.push({
              message: `Skill "${entry.skillName}" not found on echo`,
            })
          }
        }
      } else {
        const character = getCharacterById(entry.characterId)
        if (!character) {
          errors.push({ message: "Unknown character" })
        } else {
          let found = false
          let requiredStageId: string | undefined
          outer: for (const skill of character.skills) {
            if (skill.type !== entry.skillType) continue
            for (const stage of skill.stages) {
              if (stageLabel(skill.name, stage.newName) === entry.skillName) {
                found = true
                requiredStageId = stage.requiresStageId
                break outer
              }
            }
          }
          if (!found) {
            errors.push({ message: `Skill "${entry.skillName}" not found` })
          } else if (requiredStageId !== undefined) {
            const prevSameChar = entries
              .slice(0, i)
              .reverse()
              .find((e) => e.characterId === entry.characterId)
            if (prevSameChar?.skillName !== requiredStageId) {
              errors.push({
                message: `Stage "${entry.skillName}" requires "${requiredStageId}" to immediately precede it`,
              })
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      rowErrors.set(entry.id, errors)
      invalidRowIds.add(entry.id)
    }
  }

  return { rowErrors, invalidRowIds }
}
