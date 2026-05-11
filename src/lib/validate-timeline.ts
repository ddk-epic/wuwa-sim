import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "./catalog"
import { findStageByEntry } from "./stage"

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

export function validateTimeline(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
): ValidationResult {
  const internalErrors = new Map<string, InternalError[]>()
  const invalidRowIds = new Set<string>()

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const errors: InternalError[] = []

    const resolved = findStageByEntry(entry, slots, loadouts)
    const skillType = resolved?.skillType ?? null
    const requiredStageId = resolved?.requiresStageId

    // Intro Skill must follow Outro Skill
    if (skillType === "Intro Skill") {
      const prev = i > 0 ? entries[i - 1] : null
      const prevSkillType = prev
        ? (findStageByEntry(prev, slots, loadouts)?.skillType ?? null)
        : null
      if (prevSkillType !== "Outro Skill") {
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
    } else if (skillType === null) {
      const character = getCharacterById(entry.characterId)
      if (!character) {
        errors.push({ message: "Unknown character", isConsequence: false })
      } else {
        errors.push({
          message: `Stage "${entry.stageId}" not found`,
          isConsequence: false,
        })
      }
    } else if (skillType !== "Echo Skill" && requiredStageId !== undefined) {
      const prevSameChar = entries
        .slice(0, i)
        .reverse()
        .find((e) => e.characterId === entry.characterId)
      if (!prevSameChar || prevSameChar.stageId !== requiredStageId) {
        errors.push({
          message: `Stage "${entry.stageId}" requires "${requiredStageId}" to immediately precede it`,
          isConsequence: false,
        })
      } else if (invalidRowIds.has(prevSameChar.id)) {
        errors.push({
          message: `Stage "${entry.stageId}" requires "${requiredStageId}" to immediately precede it`,
          isConsequence: true,
        })
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
