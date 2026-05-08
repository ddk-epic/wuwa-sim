import type { VariantKind } from "./character"

export interface TimelineEntry {
  id: string
  characterId: number
  stageId: string
  variantKind?: VariantKind
}
