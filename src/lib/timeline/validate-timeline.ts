import type { Footing, VariantKind } from "#/types/character"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import { getCharacterById } from "../loadout/catalog"
import { findStageByEntry, stageEntryFooting } from "../stage"

function footingExitState(footing: Footing): "ground" | "air" {
  if (footing === "air") return "air"
  if (typeof footing === "object" && "launch" in footing) return "air"
  return "ground"
}

function isLand(footing: Footing): boolean {
  return typeof footing === "object" && "land" in footing
}

// Variant-aware exit footing: for { launch } / { land } stages, the exit depends on whether
// the variant's actionTime covers the commit frame (ADR-0022 amendment).
function resolvedExitFooting(
  footing: Footing,
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
  // A { launch } runs from the ground (reached via a fall if entered airborne), a
  // { land } from the air; an uncommitted transition returns to that required entry.
  const requiredEntry: "ground" | "air" = "launch" in footing ? "ground" : "air"

  // swap: transition fires later via trailing window; cursor stays at the required entry
  if (variantKind === "swap") return requiredEntry

  // cancel/instantCancel: commit only if variant's actionTime covers the commit frame
  if (variantKind === "cancel" || variantKind === "instantCancel") {
    const variantActionTime =
      stage.variants?.[variantKind]?.actionTime ?? stage.actionTime
    return commitFrame <= variantActionTime ? transitionTarget : requiredEntry
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
          const skillBaseName = prev.stageId.split(".")[3] ?? ""
          if (
            prevResolved?.skillType === "Movement" &&
            comboAllows.some((a) => a.toLowerCase() === skillBaseName)
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

  // Footing-walk pass: team-global cursor + per-character swap-deferred footing.
  // Statically mirrors the Trailing Window's footingChanges: a swap stage's
  // launch/land exit is deferred until the same character re-enters (ADR-0022).
  let footingCursor: "ground" | "air" = "ground"
  const deferredFooting = new Map<number, "ground" | "air">()
  for (const entry of entries) {
    if (invalidRowIds.has(entry.id)) {
      // Skip footing check for already-invalid entries to avoid noise
      continue
    }
    const resolved = findStageByEntry(entry, slots, loadouts)
    const footing = resolved?.stage.footing
    if (!footing) continue

    const deferred = deferredFooting.get(entry.characterId) ?? null
    const effectiveFooting = deferred ?? footingCursor
    if (deferred !== null) {
      deferredFooting.delete(entry.characterId)
      // On-field invariant: the deferred exit commits to team footing on re-entry
      footingCursor = deferred
    }

    // Hard error only when grounded and the stage needs an airborne entry with
    // nothing to put us there. The reverse — airborne meeting a ground-entry stage,
    // including a { launch } — is legal: gravity lands us first (a soft fall), so it
    // is handled in the warn pass, not here. (See references/footing.md.)
    let footingError: string | null = null
    if (effectiveFooting === "ground" && stageEntryFooting(footing) === "air") {
      footingError = isLand(footing)
        ? "Nothing to land from — not currently airborne"
        : "Launch/Jump required before an aerial stage"
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
      entry.variantKind,
      resolved.stage,
    )

    // Swap: exit footing is deferred to the trailing window, applied on re-entry
    if (entry.variantKind === "swap") {
      deferredFooting.set(entry.characterId, footingExitState(footing))
    }
  }

  // Footing-walk pass 2: air→ground soft warning (mirrors the deferral logic)
  let footingCursorForWarn: "ground" | "air" = "ground"
  const deferredFootingForWarn = new Map<number, "ground" | "air">()
  for (const entry of entries) {
    if (invalidRowIds.has(entry.id)) continue
    const resolved = findStageByEntry(entry, slots, loadouts)
    const footing = resolved?.stage.footing
    if (footing) {
      const deferred = deferredFootingForWarn.get(entry.characterId) ?? null
      const effectiveFooting = deferred ?? footingCursorForWarn
      if (deferred !== null) {
        deferredFootingForWarn.delete(entry.characterId)
        // On-field invariant: the deferred exit commits to team footing on re-entry
        footingCursorForWarn = deferred
      }

      // Airborne meeting any ground-entry stage (sustained "ground" or a { launch },
      // which lands you before it re-launches) costs a fall.
      if (
        effectiveFooting === "air" &&
        stageEntryFooting(footing) === "ground"
      ) {
        const existing = rowWarnings.get(entry.id) ?? []
        existing.push({
          message: "Fall frames apply (airborne → grounded-entry stage)",
        })
        rowWarnings.set(entry.id, existing)
      }
      footingCursorForWarn = resolvedExitFooting(
        footing,
        entry.variantKind,
        resolved.stage,
      )
      if (entry.variantKind === "swap") {
        deferredFootingForWarn.set(entry.characterId, footingExitState(footing))
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
