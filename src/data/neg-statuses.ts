import type { NegStatusType } from "./neg-status-types"
import type { NegStatusDef } from "#/types/target"

export const AERO_EROSION: NegStatusDef = {
  type: "Aero Erosion",
  element: "Aero",
  label: "Aero Erosion",
  cap: 3,
  duration: 15,
  tickInterval: 2.5,
  baseUnit: 2150,
  stackFactor: { 1: 0.8, 2: 2, 3: 4, 4: 6, 5: 8, 6: 10 },
}

export const NEG_STATUS_DEFS: Partial<Record<NegStatusType, NegStatusDef>> = {
  "Aero Erosion": AERO_EROSION,
}

export function negStatusDef(type: NegStatusType): NegStatusDef {
  const def = NEG_STATUS_DEFS[type]
  if (!def) {
    throw new Error(`No NegStatusDef registered for "${type}"`)
  }
  return def
}
