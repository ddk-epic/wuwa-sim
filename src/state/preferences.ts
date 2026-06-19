import { atom } from "jotai"
import { atomWithStorage, createJSONStorage } from "jotai/utils"
import type { LogVariant } from "#/types/simulation-log"

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

// atomWithStorage's default JSON storage only parses; it would not coerce a
// partial or legacy stored object, so reads route through mergeWithDefaults.
const jsonStorage = createJSONStorage<UiPreferences>(() => localStorage)
const storage = {
  ...jsonStorage,
  getItem: (key: string, initialValue: UiPreferences) =>
    mergeWithDefaults(jsonStorage.getItem(key, initialValue)),
}

export const preferencesAtom = atomWithStorage<UiPreferences>(
  STORAGE_KEY,
  DEFAULTS,
  storage,
  { getOnInit: true },
)

export const autoRunAtom = atom(
  (get) => get(preferencesAtom).autoRun,
  (get, set, value: boolean) =>
    set(preferencesAtom, { ...get(preferencesAtom), autoRun: value }),
)

export const defaultLogVariantAtom = atom(
  (get) => get(preferencesAtom).defaultLogVariant,
  (get, set, value: LogVariant) =>
    set(preferencesAtom, { ...get(preferencesAtom), defaultLogVariant: value }),
)
