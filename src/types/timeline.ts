import type { VariantKind } from "./character"

export interface TimelineEntry {
  id: string
  characterId: number
  stageId: string
  variantKind?: VariantKind
}

export interface TimelineGroup {
  kind: "group"
  id: string
  label: string
  locked: boolean
  entries: TimelineEntry[]
}

export type TimelineNode = (TimelineEntry & { kind: "entry" }) | TimelineGroup

export function flattenNodes(nodes: TimelineNode[]): TimelineEntry[] {
  return nodes.flatMap((node) => {
    if (node.kind === "group") return node.entries
    const { id, characterId, stageId, variantKind } = node
    return [{ id, characterId, stageId, variantKind }]
  })
}
