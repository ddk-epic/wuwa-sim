import type { TimelineNode, TimelineEntry } from "#/types/timeline"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { SkillType } from "#/types/character"
import type { ActionTimeStage } from "#/lib/stage"
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "#/lib/timeline/validate-timeline"
import { getCharacterById } from "#/lib/loadout/catalog"
import { ELEMENT_HEX } from "#/data/elements"
import { findStageByEntry } from "#/lib/stage"
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
      /** Index of this group among all top-level nodes */
      containerIndex: number
      /** Set by applyDragPreview to collapse the entire group block while dragging. */
      hidden?: boolean
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
      charName: string
      charHex: string
      elementLetter: string
      skillType: SkillType | null
      damageType: SkillType | null
      skillName: string | null
      stageWithVariants: ActionTimeStage | null
      isInvalid: boolean
      errors: ValidationError[]
      warnings: ValidationWarning[]
      showMessage: boolean
      /**
       * Index within the item's container: node index for top-level entries,
       * within-group index for group entries.
       */
      containerIndex: number
      /** Set by applyDragPreview to collapse the source row while dragging. */
      hidden?: boolean
    }
  | {
      type: "ghost"
      /** ID of the entry being dragged — used as React key. */
      sourceId: string
      charHex: string
      skillName: string | null
    }
  | {
      type: "groupGhost"
      /** ID of the group being dragged — used as React key. */
      sourceGroupId: string
      label: string
      entryCount: number
      dominantHex: string
      distinctCharIds: number[]
    }

function buildShowMessageIds(
  nodes: TimelineNode[],
  validation: ValidationResult,
  logWarnings: Map<string, ValidationWarning[]>,
): Set<string> {
  const ids = new Set<string>()
  let remaining = 2
  for (const node of nodes) {
    const entries: Array<{ id: string }> =
      node.kind === "group" ? node.entries : [node]
    for (const e of entries) {
      if (remaining === 0) return ids
      if (
        (validation.rowErrors.get(e.id)?.length ?? 0) > 0 ||
        (validation.rowWarnings.get(e.id)?.length ?? 0) > 0 ||
        (logWarnings.get(e.id)?.length ?? 0) > 0
      ) {
        ids.add(e.id)
        remaining--
      }
    }
  }
  return ids
}

function resolveEntryFields(
  entry: TimelineEntry,
  slots: Slots,
  loadouts: SlotLoadout[],
  validation: ValidationResult,
  logWarnings: Map<string, ValidationWarning[]>,
  showMessageIds: Set<string>,
): Pick<
  Extract<RenderItem, { type: "entry" }>,
  | "charName"
  | "charHex"
  | "elementLetter"
  | "skillType"
  | "damageType"
  | "skillName"
  | "stageWithVariants"
  | "isInvalid"
  | "errors"
  | "warnings"
  | "showMessage"
> {
  const char = getCharacterById(entry.characterId)
  const charHex = (char?.element && ELEMENT_HEX[char.element]) ?? "#888"
  const charName = char?.name ?? "—"
  const elementLetter = char?.element[0] ?? "?"

  const resolved = findStageByEntry(entry, slots, loadouts)
  const skillType = resolved?.skillType ?? null
  const damageType = resolved
    ? (resolved.damage[0]?.type ?? resolved.skillType)
    : null
  const skillName = resolved?.skillName ?? null
  const stageWithVariants =
    resolved !== null &&
    resolved.stage.variants !== undefined &&
    Object.keys(resolved.stage.variants).length > 0
      ? resolved.stage
      : null

  const isInvalid = validation.invalidRowIds.has(entry.id)
  const errors = validation.rowErrors.get(entry.id) ?? []
  // Structural warnings (live, from the validator) + engine Diagnostics (from
  // the last run's log) share one display channel.
  const warnings = [
    ...(validation.rowWarnings.get(entry.id) ?? []),
    ...(logWarnings.get(entry.id) ?? []),
  ]
  const showMessage = showMessageIds.has(entry.id)

  return {
    charName,
    charHex,
    elementLetter,
    skillType,
    damageType,
    skillName,
    stageWithVariants,
    isInvalid,
    errors,
    warnings,
    showMessage,
  }
}

export function buildTimelineRenderItems(
  nodes: TimelineNode[],
  expandedGroupIds: Set<string>,
  slots: Slots,
  loadouts: SlotLoadout[],
  validation: ValidationResult,
  logWarnings: Map<string, ValidationWarning[]> = new Map(),
): RenderItem[] {
  const items: RenderItem[] = []
  let flatIndex = 0
  const showMessageIds = buildShowMessageIds(nodes, validation, logWarnings)

  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
    const node = nodes[nodeIndex]
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
        containerIndex: nodeIndex,
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
            containerIndex: entryIdx,
            ...resolveEntryFields(
              entry,
              slots,
              loadouts,
              validation,
              logWarnings,
              showMessageIds,
            ),
          })
        })
      } else {
        flatIndex += node.entries.length
      }
    } else {
      const entry: TimelineEntry = {
        id: node.id,
        characterId: node.characterId,
        stageId: node.stageId,
        variantKind: node.variantKind,
      }
      items.push({
        type: "entry",
        entry,
        flatIndex: flatIndex++,
        inGroup: false,
        groupId: null,
        groupLocked: false,
        isLastInGroup: false,
        lastInGroupGradient: null,
        groupFirstCharHex: null,
        containerIndex: nodeIndex,
        ...resolveEntryFields(
          entry,
          slots,
          loadouts,
          validation,
          logWarnings,
          showMessageIds,
        ),
      })
    }
  }

  return items
}
