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

export interface TimelineLoopMarker {
  kind: "loopMarker"
  id: string
}

export type TimelineNode =
  | (TimelineEntry & { kind: "entry" })
  | TimelineGroup
  | TimelineLoopMarker

export function flattenNodes(nodes: TimelineNode[]): TimelineEntry[] {
  return nodes.flatMap((node) => {
    if (node.kind === "group") return node.entries
    if (node.kind === "loopMarker") return []
    const { id, characterId, stageId, variantKind } = node
    return [{ id, characterId, stageId, variantKind }]
  })
}

/** Cut the Timeline at the Loop Marker into the two ordered Rotations. */
export function splitRotations(nodes: TimelineNode[]): {
  opener: TimelineEntry[]
  loop: TimelineEntry[]
} {
  const markerIndex = nodes.findIndex((n) => n.kind === "loopMarker")
  if (markerIndex === -1) return { opener: flattenNodes(nodes), loop: [] }
  return {
    opener: flattenNodes(nodes.slice(0, markerIndex)),
    loop: flattenNodes(nodes.slice(markerIndex + 1)),
  }
}
