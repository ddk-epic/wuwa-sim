import type { Slots, SlotLoadout } from "#/types/loadout"
import type { TimelineNode } from "#/types/timeline"

export interface ImportExportPayload {
  team: {
    slots: Slots
    loadouts: [SlotLoadout, SlotLoadout, SlotLoadout]
    focusedId: number | null
  }
  timeline: TimelineNode[] | null
}

export function encodePayload(payload: ImportExportPayload): string {
  return btoa(JSON.stringify(payload))
}

export function decodePayload(encoded: string): ImportExportPayload {
  let json: string
  try {
    json = atob(encoded.trim())
  } catch {
    throw new Error("Invalid base64 string")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error("Decoded value is not valid JSON")
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("team" in parsed) ||
    !("timeline" in parsed)
  ) {
    throw new Error("Missing required fields: team, timeline")
  }

  return parsed as ImportExportPayload
}
