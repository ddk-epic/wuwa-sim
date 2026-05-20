import type { TimelineNode, TimelineEntry } from "#/types/timeline"
import type { Slots } from "#/types/loadout"
import {
  buildGroupGradient,
  getDominantHex,
  getDistinctCharsBySlot,
  getGroupFirstCharHex,
} from "./timeline-group-formatting"

export type RenderItem =
  | {
      type: "groupHeader"
      groupId: string
      label: string
      locked: boolean
      entryCount: number
      startFlatIndex: number
      gradient: string
      dominantHex: string
      distinctCharIds: number[]
    }
  | {
      type: "entry"
      entry: TimelineEntry
      flatIndex: number
      inGroup: boolean
      groupId: string | null
      groupLocked: boolean
      isLastInGroup: boolean
      lastInGroupGradient: string | null
      groupFirstCharHex: string | null
    }

export function buildTimelineRenderItems(
  nodes: TimelineNode[],
  expandedGroupIds: Set<string>,
  slots: Slots,
): RenderItem[] {
  const items: RenderItem[] = []
  let flatIndex = 0

  for (const node of nodes) {
    if (node.kind === "group") {
      const isExpanded = expandedGroupIds.has(node.id)
      const startFlatIndex = flatIndex
      const gradient = buildGroupGradient(node.entries, slots)
      const groupFirstCharHex = getGroupFirstCharHex(node.entries, slots)
      const dominantHex = getDominantHex(node.entries)
      const distinctCharIds = getDistinctCharsBySlot(node.entries, slots)
      items.push({
        type: "groupHeader",
        groupId: node.id,
        label: node.label,
        locked: node.locked,
        entryCount: node.entries.length,
        startFlatIndex,
        gradient,
        dominantHex,
        distinctCharIds,
      })
      if (isExpanded) {
        node.entries.forEach((entry, entryIdx) => {
          const isLast = entryIdx === node.entries.length - 1
          items.push({
            type: "entry",
            entry,
            flatIndex: flatIndex++,
            inGroup: true,
            groupId: node.id,
            groupLocked: node.locked,
            isLastInGroup: isLast,
            lastInGroupGradient: isLast ? gradient : null,
            groupFirstCharHex,
          })
        })
      } else {
        flatIndex += node.entries.length
      }
    } else {
      const { id, characterId, stageId, variantKind } = node
      items.push({
        type: "entry",
        entry: { id, characterId, stageId, variantKind },
        flatIndex: flatIndex++,
        inGroup: false,
        groupId: null,
        groupLocked: false,
        isLastInGroup: false,
        lastInGroupGradient: null,
        groupFirstCharHex: null,
      })
    }
  }

  return items
}
