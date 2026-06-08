import type { LogVariant } from "#/types/simulation-log"
import { useLocalStorage } from "./useLocalStorage"

export interface UiPreferences {
  autoRun: boolean
  defaultLogVariant: LogVariant
}

const DEFAULTS: UiPreferences = {
  autoRun: true,
  defaultLogVariant: "table",
}

const STORAGE_KEY = "wuwa.preferences"

function mergeWithDefaults(stored: unknown): UiPreferences {
  if (stored === null || typeof stored !== "object") return DEFAULTS
  const partial = stored as Partial<UiPreferences>
  return {
    autoRun:
      typeof partial.autoRun === "boolean" ? partial.autoRun : DEFAULTS.autoRun,
    defaultLogVariant:
      partial.defaultLogVariant === "table" ||
      partial.defaultLogVariant === "timeline"
        ? partial.defaultLogVariant
        : DEFAULTS.defaultLogVariant,
  }
}

export function useUiPreferences(): [
  UiPreferences,
  (patch: Partial<UiPreferences>) => void,
] {
  const [prefs, setPrefs] = useLocalStorage<UiPreferences>(
    STORAGE_KEY,
    DEFAULTS,
    mergeWithDefaults,
  )

  function applyPatch(patch: Partial<UiPreferences>) {
    setPrefs({ ...prefs, ...patch })
  }

  return [prefs, applyPatch]
}
