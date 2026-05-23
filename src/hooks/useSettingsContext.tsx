import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import type { Settings } from "./useSettings"

interface SettingsActions {
  setSettings: (patch: Partial<Settings>) => void
}

interface SettingsContextValue {
  settings: Settings
  actions: SettingsActions
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({
  settings,
  actions,
  children,
}: {
  settings: Settings
  actions: SettingsActions
  children: ReactNode
}) {
  return (
    <SettingsContext.Provider value={{ settings, actions }}>
      {children}
    </SettingsContext.Provider>
  )
}

function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error("Settings hook must be used within a SettingsProvider")
  }
  return ctx
}

export function useReactionDelay(): number {
  return useSettingsContext().settings.reactionDelay
}

export function useSwapFrames(): number {
  return useSettingsContext().settings.swapFrames
}

export function useVariantFloor(): number {
  return useSettingsContext().settings.variantFloor
}

export function useFallFrames(): number {
  return useSettingsContext().settings.fallFrames
}

export function useSettingsValue(): Settings {
  return useSettingsContext().settings
}

export function useSettingsActions(): SettingsActions {
  return useSettingsContext().actions
}
