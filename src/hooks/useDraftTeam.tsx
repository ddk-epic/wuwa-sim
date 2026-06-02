import { useState } from "react"
import type { ReactNode } from "react"
import { emptyLoadout } from "#/lib/loadout/template"
import { applySlotPatch, toggleCharacter } from "#/lib/loadout/team-ops"
import type { TeamComposition } from "#/lib/loadout/team-ops"
import { TeamProvider } from "./useTeamContext"
import type { TeamContextValue } from "./useTeamContext"

/** The in-memory draft: a named composition, with no Origin and no live storage. */
interface DraftTeam extends TeamComposition {
  name: string
}

function emptyDraft(): DraftTeam {
  return {
    name: "New team",
    slots: [null, null, null],
    loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
    focusedId: null,
  }
}

/**
 * Mirrors `useTeam`'s return shape but is backed by `useState`, so a Library
 * draft can be composed without ever writing the live `wuwa.team` keys. Its only
 * commit path is the create modal's "Move to sim".
 */
export function useDraftTeam(): TeamContextValue {
  const [draft, setDraft] = useState<DraftTeam>(emptyDraft)
  return {
    name: draft.name,
    slots: draft.slots,
    loadouts: draft.loadouts,
    focusedId: draft.focusedId,
    selectedCount: draft.slots.filter((s) => s !== null).length,
    setName: (name) => setDraft((p) => ({ ...p, name })),
    toggleCharacter: (id) => setDraft((p) => toggleCharacter(p, id)),
    focusCharacter: (id) => setDraft((p) => ({ ...p, focusedId: id })),
    setSlotPatch: (i, patch) => setDraft((p) => applySlotPatch(p, i, patch)),
  }
}

/** Feeds a fresh draft into the shared `TeamContext`, so the Team Builder body is context-blind. */
export function DraftTeamProvider({ children }: { children: ReactNode }) {
  const draft = useDraftTeam()
  return <TeamProvider value={draft}>{children}</TeamProvider>
}
