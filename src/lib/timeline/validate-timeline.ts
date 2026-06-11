import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "../loadout/catalog"
import { findStageByEntry } from "../stage"

// Footing is deliberately NOT validated here. Footing rules are frame-dependent
// (variant advances, Reaction Delay, trailing-window commits), so a static walk
// can only mirror the engine approximately — and a previous mirror drifted (it
// ignored Reaction Delay). The engine emits footing violations as Diagnostics on
// the ActionEvent of the run that observed them; do not re-add a predictor here.

export interface ValidationError {
  message: string
}

export interface ValidationWarning {
  message: string
}

export interface ValidationResult {
  rowErrors: Map<string, ValidationError[]>
  rowWarnings: Map<string, ValidationWarning[]>
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
  const rowWarnings = new Map<string, ValidationWarning[]>()

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const errors: InternalError[] = []

    const resolved = findStageByEntry(entry, slots, loadouts)
    const skillType = resolved?.skillType ?? null
    const requiredStageId = resolved?.requiresPriorStageId

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
      const minDelay = resolved?.minDelay
      if (minDelay !== undefined) {
        // Scan back for any earlier matching prerequisite on the same character.
        let anchor: TimelineEntry | undefined
        for (let j = i - 1; j >= 0; j--) {
          const prev = entries[j]
          if (prev.characterId !== entry.characterId) continue
          if (prev.stageId === requiredStageId) {
            anchor = prev
            break
          }
        }
        if (!anchor) {
          errors.push({
            message: `Stage "${entry.stageId}" requires a prior "${requiredStageId}" on the same character`,
            isConsequence: false,
          })
        } else if (invalidRowIds.has(anchor.id)) {
          errors.push({
            message: `Stage "${entry.stageId}" requires a prior "${requiredStageId}" on the same character`,
            isConsequence: true,
          })
        }
      } else {
        // The prerequisite must be the immediately preceding same-character entry.
        let effectivePrev: TimelineEntry | undefined
        for (let j = i - 1; j >= 0; j--) {
          const prev = entries[j]
          if (prev.characterId !== entry.characterId) continue
          effectivePrev = prev
          break
        }
        if (!effectivePrev || effectivePrev.stageId !== requiredStageId) {
          errors.push({
            message: `Stage "${entry.stageId}" requires "${requiredStageId}" to immediately precede it`,
            isConsequence: false,
          })
        } else if (invalidRowIds.has(effectivePrev.id)) {
          errors.push({
            message: `Stage "${entry.stageId}" requires "${requiredStageId}" to immediately precede it`,
            isConsequence: true,
          })
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

  // Pass 3: swap → same-character warnings
  for (let i = 0; i < entries.length - 1; i++) {
    const entry = entries[i]
    if (
      entry.variantKind === "swap" &&
      entries[i + 1].characterId === entry.characterId
    ) {
      const existing = rowWarnings.get(entry.id) ?? []
      existing.push({
        message: "Swap forces the next entry to be a different character",
      })
      rowWarnings.set(entry.id, existing)
    }
  }

  return { rowErrors, rowWarnings, invalidRowIds }
}
