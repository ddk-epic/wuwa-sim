import { compressToBase64, decompressFromBase64 } from "lz-string"
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
  return compressToBase64(JSON.stringify(payload))
}

export function decodePayload(encoded: string): ImportExportPayload {
  let json: string
  try {
    const result = decompressFromBase64(encoded.trim())
    if (result === null) throw new Error()
    json = result
  } catch {
    throw new Error("Invalid or corrupted export code")
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
