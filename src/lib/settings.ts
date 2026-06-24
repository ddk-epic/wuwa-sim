/**
 * Per-team simulation parameters: the four frame-delay knobs plus the
 * start-with-full-energy flag. These belong to the team, so a team's results are
 * defined by the team rather than by whoever is viewing it. A new team starts at
 * {@link DEFAULT_SETTINGS}; there is no global user-editable settings tier.
 */
export interface Settings {
  reactionDelay: number
  swapFrames: number
  variantFloor: number
  fallFrames: number
  startWithFullEnergy: boolean
  startWithFullConcerto: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  reactionDelay: 6,
  swapFrames: 6,
  variantFloor: 15,
  fallFrames: 15,
  startWithFullEnergy: false,
  startWithFullConcerto: false,
}

const FRAME_KEYS = [
  "reactionDelay",
  "swapFrames",
  "variantFloor",
  "fallFrames",
] as const

function clampFrame(value: number): number {
  return Math.max(0, Math.min(60, Math.round(value)))
}

/** Coerce unknown stored JSON into Settings, filling missing fields from defaults. */
export function coerceStoredSettings(stored: unknown): Settings {
  if (stored === null || typeof stored !== "object") {
    return { ...DEFAULT_SETTINGS }
  }
  // Boundary: stored is unknown; every field is typeof-checked.
  const partial = stored as Partial<Settings>
  return {
    reactionDelay:
      typeof partial.reactionDelay === "number"
        ? partial.reactionDelay
        : DEFAULT_SETTINGS.reactionDelay,
    swapFrames:
      typeof partial.swapFrames === "number"
        ? partial.swapFrames
        : DEFAULT_SETTINGS.swapFrames,
    variantFloor:
      typeof partial.variantFloor === "number"
        ? partial.variantFloor
        : DEFAULT_SETTINGS.variantFloor,
    fallFrames:
      typeof partial.fallFrames === "number"
        ? partial.fallFrames
        : DEFAULT_SETTINGS.fallFrames,
    startWithFullEnergy:
      typeof partial.startWithFullEnergy === "boolean"
        ? partial.startWithFullEnergy
        : DEFAULT_SETTINGS.startWithFullEnergy,
    startWithFullConcerto:
      typeof partial.startWithFullConcerto === "boolean"
        ? partial.startWithFullConcerto
        : DEFAULT_SETTINGS.startWithFullConcerto,
  }
}

/** Apply a patch over current settings, clamping every frame knob to [0, 60]. */
export function applySettingsPatch(
  current: Settings,
  patch: Partial<Settings>,
): Settings {
  const next: Settings = { ...current }
  for (const key of FRAME_KEYS) {
    const v = patch[key]
    if (v !== undefined) next[key] = clampFrame(v)
  }
  if (patch.startWithFullEnergy !== undefined) {
    next.startWithFullEnergy = patch.startWithFullEnergy
  }
  if (patch.startWithFullConcerto !== undefined) {
    next.startWithFullConcerto = patch.startWithFullConcerto
  }
  return next
}
