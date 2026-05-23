import { useLocalStorage } from "./useLocalStorage"

export interface Settings {
  reactionDelay: number
  swapFrames: number
  variantFloor: number
  fallFrames: number
}

const DEFAULTS: Settings = {
  reactionDelay: 6,
  swapFrames: 6,
  variantFloor: 15,
  fallFrames: 21,
}
const STORAGE_KEY = "wuwa.settings"

function clamp(value: number): number {
  return Math.max(0, Math.min(60, Math.round(value)))
}

function mergeWithDefaults(stored: unknown): Settings {
  if (stored === null || typeof stored !== "object") return DEFAULTS
  const partial = stored as Partial<Settings>
  return {
    reactionDelay:
      typeof partial.reactionDelay === "number"
        ? partial.reactionDelay
        : DEFAULTS.reactionDelay,
    swapFrames:
      typeof partial.swapFrames === "number"
        ? partial.swapFrames
        : DEFAULTS.swapFrames,
    variantFloor:
      typeof partial.variantFloor === "number"
        ? partial.variantFloor
        : DEFAULTS.variantFloor,
    fallFrames:
      typeof partial.fallFrames === "number"
        ? partial.fallFrames
        : DEFAULTS.fallFrames,
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useLocalStorage<Settings>(
    STORAGE_KEY,
    DEFAULTS,
    mergeWithDefaults,
  )

  function applyPatch(patch: Partial<Settings>) {
    const next: Settings = { ...settings }
    if (patch.reactionDelay !== undefined) {
      next.reactionDelay = clamp(patch.reactionDelay)
    }
    if (patch.swapFrames !== undefined) {
      next.swapFrames = clamp(patch.swapFrames)
    }
    if (patch.variantFloor !== undefined) {
      next.variantFloor = clamp(patch.variantFloor)
    }
    if (patch.fallFrames !== undefined) {
      next.fallFrames = clamp(patch.fallFrames)
    }
    setSettings(next)
  }

  return [settings, applyPatch]
}
