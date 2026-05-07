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

interface InternalError {
  message: string
  isConsequence: boolean
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
  const internalErrors = new Map<string, InternalError[]>()
  const invalidRowIds = new Set<string>()

  // Pass 1: detect all errors per row
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const errors: InternalError[] = []

    if (entry.skillType === "Intro Skill") {
      const prev = i > 0 ? entries[i - 1] : null
      if (prev?.skillType !== "Outro Skill") {
        errors.push({
          message: "Intro Skill must immediately follow an Outro Skill",
          isConsequence: false,
        })
      }
    }

    const slotIndex = slots.indexOf(entry.characterId)
    if (slotIndex === -1) {
      errors.push({
        message: "Character is not in the team",
        isConsequence: false,
      })
    } else {
      if (entry.skillType === "Echo Skill") {
        const echoId = loadouts[slotIndex]?.echoId ?? null
        const echo = echoId !== null ? getEchoById(echoId) : null
        if (!echo) {
          errors.push({
            message: "No echo equipped for this slot",
            isConsequence: false,
          })
        } else {
          const found = echo.skill.stages.some(
            (s) => stageLabel(echo.name, s.newName) === entry.skillName,
          )
          if (!found) {
            errors.push({
              message: `Skill "${entry.skillName}" not found on echo`,
              isConsequence: false,
            })
          }
        }
      } else {
        const character = getCharacterById(entry.characterId)
        if (!character) {
          errors.push({ message: "Unknown character", isConsequence: false })
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
            errors.push({
              message: `Skill "${entry.skillName}" not found`,
              isConsequence: false,
            })
          } else if (requiredStageId !== undefined) {
            const prevSameChar = entries
              .slice(0, i)
              .reverse()
              .find((e) => e.characterId === entry.characterId)
            if (!prevSameChar || prevSameChar.skillName !== requiredStageId) {
              errors.push({
                message: `Stage "${entry.skillName}" requires "${requiredStageId}" to immediately precede it`,
                isConsequence: false,
              })
            } else if (invalidRowIds.has(prevSameChar.id)) {
              // prereq is present and name matches but was itself invalid → cascade
              errors.push({
                message: `Stage "${entry.skillName}" requires "${requiredStageId}" to immediately precede it`,
                isConsequence: true,
              })
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      internalErrors.set(entry.id, errors)
      invalidRowIds.add(entry.id)
    }
  }

  // Pass 2: build public rowErrors — suppress consequence-only rows
  const rowErrors = new Map<string, ValidationError[]>()
  for (const [id, errs] of internalErrors) {
    const directErrors = errs
      .filter((e) => !e.isConsequence)
      .map((e) => ({ message: e.message }))
    if (directErrors.length > 0) {
      rowErrors.set(id, directErrors)
    }
  }

  return { rowErrors, invalidRowIds }
}
