import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "../loadout/catalog"
import { findStageByEntry } from "../stage/stage"

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

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const errors: InternalError[] = []

    const resolved = findStageByEntry(entry, slots, loadouts)
    const skillType = resolved?.skillType ?? null
    const requiredStageId = resolved?.requiresStageId
    const comboAllows = resolved?.comboAllows ?? []

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
      // Walk backwards, skipping Movement entries whose skill name is in comboAllows
      let effectivePrev: TimelineEntry | undefined
      for (let j = i - 1; j >= 0; j--) {
        const prev = entries[j]
        if (prev.characterId !== entry.characterId) continue
        if (comboAllows.length > 0) {
          const prevResolved = findStageByEntry(prev, slots, loadouts)
          const skillBaseName = prev.stageId.split("::")[0]
          if (
            prevResolved?.skillType === "Movement" &&
            (comboAllows as readonly string[]).includes(skillBaseName)
          ) {
            continue
          }
        }
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

    if (errors.length > 0) {
      internalErrors.set(entry.id, errors)
      invalidRowIds.add(entry.id)
    }
  }

  // Footing-walk pass: team-global cursor, hard-error cases from ADR-0022
  let footingCursor: "ground" | "air" = "ground"
  for (const entry of entries) {
    if (invalidRowIds.has(entry.id)) {
      // Skip footing check for already-invalid entries to avoid noise
      continue
    }
    const resolved = findStageByEntry(entry, slots, loadouts)
    const footing = resolved?.stage.footing
    if (!footing) continue

    let footingError: string | null = null
    if (footingCursor === "ground" && footing === "air") {
      footingError = "Launch/Jump required before an aerial stage"
    } else if (footingCursor === "air" && footing === "launch") {
      footingError = "Already airborne — cannot launch again"
    } else if (footingCursor === "ground" && footing === "land") {
      footingError = "Nothing to land from — not currently airborne"
    }

    if (footingError) {
      const existing = internalErrors.get(entry.id) ?? []
      existing.push({ message: footingError, isConsequence: false })
      internalErrors.set(entry.id, existing)
      invalidRowIds.add(entry.id)
    }

    // Advance cursor to exit footing of this stage
    if (footing === "launch" || footing === "air") {
      footingCursor = "air"
    } else {
      footingCursor = "ground"
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
  const rowWarnings = new Map<string, ValidationWarning[]>()
  for (let i = 0; i < entries.length - 1; i++) {
    const entry = entries[i]
    if (
      entry.variantKind === "swap" &&
      entries[i + 1].characterId === entry.characterId
    ) {
      rowWarnings.set(entry.id, [
        { message: "Swap forces the next entry to be a different character" },
      ])
    }
  }

  return { rowErrors, rowWarnings, invalidRowIds }
}
