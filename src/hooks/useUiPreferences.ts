import { useLocalStorage } from "./useLocalStorage"

export interface UiPreferences {
  autoRun: boolean
}

const DEFAULTS: UiPreferences = {
  autoRun: true,
}

const STORAGE_KEY = "wuwa.preferences"

function mergeWithDefaults(stored: unknown): UiPreferences {
  if (stored === null || typeof stored !== "object") return DEFAULTS
  const partial = stored as Partial<UiPreferences>
  return {
    autoRun:
      typeof partial.autoRun === "boolean" ? partial.autoRun : DEFAULTS.autoRun,
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
