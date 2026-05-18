import { createContext, useContext, type ReactNode } from "react"

interface SettingsActions {
  setReactionDelay: (value: number) => void
}

interface SettingsContextValue {
  reactionDelay: number
  actions: SettingsActions
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({
  reactionDelay,
  actions,
  children,
}: {
  reactionDelay: number
  actions: SettingsActions
  children: ReactNode
}) {
  return (
    <SettingsContext.Provider value={{ reactionDelay, actions }}>
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
  return useSettingsContext().reactionDelay
}

export function useSettingsActions(): SettingsActions {
  return useSettingsContext().actions
}
