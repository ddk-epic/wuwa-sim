import type { VariantKind } from "./character"

export interface TimelineEntry {
  id: string
  characterId: number
  skillType: string
  skillName: string
  attackType: string
  variantKind?: VariantKind
  multiplier: number
}
