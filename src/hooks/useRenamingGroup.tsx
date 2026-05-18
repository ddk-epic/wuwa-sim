import { createContext, useContext } from "react"
import type { ReactNode } from "react"

interface RenamingGroupContextValue {
  renamingGroupId: string | null
  startRename: (groupId: string) => void
  endRename: () => void
}

const RenamingGroupContext = createContext<RenamingGroupContextValue | null>(
  null,
)

export function RenamingGroupProvider({
  value,
  children,
}: {
  value: RenamingGroupContextValue
  children: ReactNode
}) {
  return (
    <RenamingGroupContext.Provider value={value}>
      {children}
    </RenamingGroupContext.Provider>
  )
}

export function useRenamingGroup(): RenamingGroupContextValue {
  const ctx = useContext(RenamingGroupContext)
  if (!ctx) {
    throw new Error(
      "useRenamingGroup must be used within a RenamingGroupProvider",
    )
  }
  return ctx
}
