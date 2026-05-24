import type { Footing, VariantKind } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "../loadout/catalog"
import { findStageByEntry } from "../stage/stage"

function footingExitState(footing: Footing): "ground" | "air" {
  if (footing === "air") return "air"
  if (typeof footing === "object" && "launch" in footing) return "air"
  return "ground"
}

function isLaunch(footing: Footing): boolean {
  return typeof footing === "object" && "launch" in footing
}

function isLand(footing: Footing): boolean {
  return typeof footing === "object" && "land" in footing
}

// Variant-aware exit footing: for { launch } / { land } stages, the exit depends on whether
// the variant's actionTime covers the commit frame (ADR-0022 amendment).
function resolvedExitFooting(
  footing: Footing,
  entryFooting: "ground" | "air",
  variantKind: VariantKind | undefined,
  stage: {
    actionTime: number
    variants?: Partial<Record<VariantKind, { actionTime: number }>>
  },
): "ground" | "air" {
  if (footing === "ground") return "ground"
  if (footing === "air") return "air"

  const commitFrame = "launch" in footing ? footing.launch : footing.land
  const transitionTarget: "ground" | "air" =
    "launch" in footing ? "air" : "ground"

  // swap: transition fires later via trailing window; cursor stays at entry footing
  if (variantKind === "swap") return entryFooting

  // cancel/instantCancel: commit only if variant's actionTime covers the commit frame
  if (variantKind === "cancel" || variantKind === "instantCancel") {
    const variantActionTime =
      stage.variants?.[variantKind]?.actionTime ?? stage.actionTime
    return commitFrame <= variantActionTime ? transitionTarget : entryFooting
  }

  // Full / no variant: always exits at transition target
  return transitionTarget
}

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

  // Footing-walk pass: team-global cursor + per-character snapshots (ADR-0022)
  let footingCursor: "ground" | "air" = "ground"
  const footingSnapshots = new Map<number, "ground" | "air">()
  for (const entry of entries) {
    if (invalidRowIds.has(entry.id)) {
      // Skip footing check for already-invalid entries to avoid noise
      continue
    }
    const resolved = findStageByEntry(entry, slots, loadouts)
    const footing = resolved?.stage.footing
    if (!footing) continue

    const snap = footingSnapshots.get(entry.characterId) ?? null
    const effectiveFooting = snap ?? footingCursor
    if (snap !== null) {
      footingSnapshots.delete(entry.characterId)
      // On-field invariant: promote team cursor to snapshot value on re-entry
      footingCursor = snap
    }

    let footingError: string | null = null
    if (effectiveFooting === "ground" && footing === "air") {
      footingError = "Launch/Jump required before an aerial stage"
    } else if (effectiveFooting === "air" && isLaunch(footing)) {
      footingError = "Already airborne — cannot launch again"
    } else if (effectiveFooting === "ground" && isLand(footing)) {
      footingError = "Nothing to land from — not currently airborne"
    }

    if (footingError) {
      const existing = internalErrors.get(entry.id) ?? []
      existing.push({ message: footingError, isConsequence: false })
      internalErrors.set(entry.id, existing)
      invalidRowIds.add(entry.id)
    }

    // Advance team cursor to variant-aware exit footing
    footingCursor = resolvedExitFooting(
      footing,
      effectiveFooting,
      entry.variantKind,
      resolved.stage,
    )

    // Swap: snapshot = transition target (trailing window fires it later)
    if (entry.variantKind === "swap") {
      footingSnapshots.set(entry.characterId, footingExitState(footing))
    }
  }

  // Footing-walk pass 2: air→ground soft warning (mirrors snapshot logic)
  let footingCursorForWarn: "ground" | "air" = "ground"
  const footingSnapshotsForWarn = new Map<number, "ground" | "air">()
  for (const entry of entries) {
    if (invalidRowIds.has(entry.id)) continue
    const resolved = findStageByEntry(entry, slots, loadouts)
    const footing = resolved?.stage.footing
    if (footing) {
      const snap = footingSnapshotsForWarn.get(entry.characterId) ?? null
      const effectiveFooting = snap ?? footingCursorForWarn
      if (snap !== null) {
        footingSnapshotsForWarn.delete(entry.characterId)
        // On-field invariant: promote team cursor to snapshot value on re-entry
        footingCursorForWarn = snap
      }

      if (effectiveFooting === "air" && footing === "ground") {
        const existing = rowWarnings.get(entry.id) ?? []
        existing.push({
          message: "Fall frames apply (airborne → ground stage)",
        })
        rowWarnings.set(entry.id, existing)
      }
      footingCursorForWarn = resolvedExitFooting(
        footing,
        effectiveFooting,
        entry.variantKind,
        resolved.stage,
      )
      if (entry.variantKind === "swap") {
        footingSnapshotsForWarn.set(
          entry.characterId,
          footingExitState(footing),
        )
      }
    }
  }

  // Pass 3: build public rowErrors — suppress consequence-only rows
  const rowErrors = new Map<string, ValidationError[]>()
  for (const [id, errs] of internalErrors) {
    const directErrors = errs
      .filter((e) => !e.isConsequence)
      .map((e) => ({ message: e.message }))
    if (directErrors.length > 0) {
      rowErrors.set(id, directErrors)
    }
  }

  // Pass 4: swap → same-character warnings
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
