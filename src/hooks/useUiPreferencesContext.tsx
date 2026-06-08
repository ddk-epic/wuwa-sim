import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import type { LogVariant } from "#/types/simulation-log"
import type { UiPreferences } from "./useUiPreferences"

interface UiPreferencesActions {
  setPreferences: (patch: Partial<UiPreferences>) => void
}

interface UiPreferencesContextValue {
  preferences: UiPreferences
  actions: UiPreferencesActions
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(
  null,
)

export function UiPreferencesProvider({
  preferences,
  actions,
  children,
}: {
  preferences: UiPreferences
  actions: UiPreferencesActions
  children: ReactNode
}) {
  return (
    <UiPreferencesContext.Provider value={{ preferences, actions }}>
      {children}
    </UiPreferencesContext.Provider>
  )
}

function useUiPreferencesContext(): UiPreferencesContextValue {
  const ctx = useContext(UiPreferencesContext)
  if (!ctx)
    throw new Error(
      "UI preferences hook must be used within a UiPreferencesProvider",
    )
  return ctx
}

export function useAutoRunPreference(): boolean {
  return useUiPreferencesContext().preferences.autoRun
}

export function useDefaultLogPreference(): LogVariant {
  return useUiPreferencesContext().preferences.defaultLogVariant
}

export function useUiPreferencesActions(): UiPreferencesActions {
  return useUiPreferencesContext().actions
}
