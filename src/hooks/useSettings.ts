import { useLocalStorage } from "./useLocalStorage"

export interface Settings {
  reactionDelay: number
}

const DEFAULTS: Settings = { reactionDelay: 9 }
const STORAGE_KEY = "wuwa.settings"

export function useSettings(): [Settings, (reactionDelay: number) => void] {
  const [settings, setSettings] = useLocalStorage<Settings>(
    STORAGE_KEY,
    DEFAULTS,
  )

  function setReactionDelay(value: number) {
    const clamped = Math.max(0, Math.min(60, Math.round(value)))
    setSettings({ ...settings, reactionDelay: clamped })
  }

  return [settings, setReactionDelay]
}
