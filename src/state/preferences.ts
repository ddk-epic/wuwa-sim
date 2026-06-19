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

// getOnInit reads storage at module-eval time; bare `localStorage` throws in
// non-browser runners (Vite SSR / Vitest), so fall back to a no-op store.
const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  key: () => null,
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

// default JSON storage only parses; route reads through mergeWithDefaults to
// coerce partial/legacy stored objects.
const jsonStorage = createJSONStorage<UiPreferences>(() =>
  typeof localStorage !== "undefined" ? localStorage : noopStorage,
)
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
