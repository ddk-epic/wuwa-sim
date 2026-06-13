import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "../loadout/catalog"
import { findStageByEntry } from "../compile-character"
import { renderMessage } from "./row-messages"
import type { ValidatorMessage } from "./row-messages"

// Footing is deliberately NOT validated here. Footing rules are frame-dependent
// (variant advances, Reaction Delay, trailing-window commits), so a static walk
// can only mirror the engine approximately — and a previous mirror drifted (it
// ignored Reaction Delay). The engine emits footing violations as Diagnostics on
// the ActionEvent of the run that observed them; do not re-add a predictor here.

export interface Invalidation {
  message: string
}

export interface ValidationWarning {
  message: string
}

export interface ValidationResult {
  rowInvalid: Map<string, Invalidation[]>
  rowWarnings: Map<string, ValidationWarning[]>
  invalidRowIds: Set<string>
}

interface InternalInvalidation {
  finding: ValidatorMessage
  isConsequence: boolean
}

export function validateTimeline(
  entries: TimelineEntry[],
  slots: Slots,
  loadouts: SlotLoadout[],
): ValidationResult {
  const internalInvalid = new Map<string, InternalInvalidation[]>()
  const invalidRowIds = new Set<string>()
  const rowWarnings = new Map<string, ValidationWarning[]>()

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const invalidations: InternalInvalidation[] = []

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
        invalidations.push({
          finding: { kind: "introNeedsOutro" },
          isConsequence: false,
        })
      }
    }

    const slotIndex = slots.indexOf(entry.characterId)
    if (slotIndex === -1) {
      invalidations.push({
        finding: { kind: "characterNotInTeam" },
        isConsequence: false,
      })
    } else if (skillType === null) {
      const character = getCharacterById(entry.characterId)
      if (!character) {
        invalidations.push({
          finding: { kind: "unknownCharacter" },
          isConsequence: false,
        })
      } else {
        invalidations.push({
          finding: { kind: "stageNotFound", stageId: entry.stageId },
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
          invalidations.push({
            finding: {
              kind: "missingWindowedPrereq",
              stageId: entry.stageId,
              requiredStageId,
            },
            isConsequence: false,
          })
        } else if (invalidRowIds.has(anchor.id)) {
          invalidations.push({
            finding: {
              kind: "missingWindowedPrereq",
              stageId: entry.stageId,
              requiredStageId,
            },
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
          invalidations.push({
            finding: {
              kind: "missingChainPrereq",
              stageId: entry.stageId,
              requiredStageId,
            },
            isConsequence: false,
          })
        } else if (invalidRowIds.has(effectivePrev.id)) {
          invalidations.push({
            finding: {
              kind: "missingChainPrereq",
              stageId: entry.stageId,
              requiredStageId,
            },
            isConsequence: true,
          })
        }
      }
    }

    if (invalidations.length > 0) {
      internalInvalid.set(entry.id, invalidations)
      invalidRowIds.add(entry.id)
    }
  }

  // Pass 2: build public rowInvalid — suppress consequence-only rows
  const rowInvalid = new Map<string, Invalidation[]>()
  for (const [id, entryInvalidations] of internalInvalid) {
    const directInvalidations = entryInvalidations
      .filter((e) => !e.isConsequence)
      .map((e) => ({ message: renderMessage(e.finding) }))
    if (directInvalidations.length > 0) {
      rowInvalid.set(id, directInvalidations)
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
        message: renderMessage({ kind: "swapForcesDifferentChar" }),
      })
      rowWarnings.set(entry.id, existing)
    }
  }

  return { rowInvalid, rowWarnings, invalidRowIds }
}
