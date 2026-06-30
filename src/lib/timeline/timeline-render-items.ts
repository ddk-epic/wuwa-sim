import type { TimelineNode, TimelineEntry } from "#/types/timeline"
import type { Slots, SlotLoadout } from "#/types/loadout"
import type { SkillType } from "#/types/character"
import type { Diagnostic } from "#/types/simulation-log"
import type { ActionTimeStage } from "#/lib/stage"
import type { ValidationResult } from "#/lib/timeline/validate-timeline"
import { getCharacterById } from "#/lib/loadout/catalog"
import { ELEMENT_HEX } from "#/data/elements"
import { findStageByEntry, buildStageLabels } from "#/lib/compile-character"
import { renderMessage } from "./row-messages"
import {
  buildGroupGradient,
  getDominantHex,
  getDistinctCharsBySlot,
  getGroupFirstCharHex,
} from "./timeline-group-formatting"

/** A row message rendered to text — the view-facing shape of a finding. */
export interface RowMessageText {
  message: string
}

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
      /** Character id of the group's last entry — drives the endpoint energy threshold. */
      lastCharId: number | null
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
      errors: RowMessageText[]
      warnings: RowMessageText[]
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
      type: "openerHeader"
    }
  | {
      type: "loopMarker"
      markerId: string
      /** Index of this marker among all top-level nodes. */
      containerIndex: number
      /** Set by applyDragPreview to collapse the marker row while dragging. */
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

function resolveEntryFields(
  entry: TimelineEntry,
  slots: Slots,
  loadouts: SlotLoadout[],
  validation: ValidationResult,
  logWarnings: Map<string, Diagnostic[]>,
  resolveStageName: (stageId: string) => string,
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
  const charHex = (char?.element && ELEMENT_HEX[char.element]) ?? "#888888"
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

  const diagnostics = logWarnings.get(entry.id) ?? []
  const invalidDiagnostics = diagnostics.filter((d) => d.severity === "invalid")
  // A runtime invalid diagnostic reddens the row alongside the structural validator.
  const isInvalid =
    validation.invalidRowIds.has(entry.id) || invalidDiagnostics.length > 0
  const findings = validation.findings.get(entry.id) ?? []
  const errors = [
    ...findings.filter((f) => f.severity === "invalid").map((f) => f.message),
    ...invalidDiagnostics,
  ].map((m) => ({ message: renderMessage(m, resolveStageName) }))
  // Structural warnings (live, from the validator) + engine Diagnostics (from
  // the last run's log) share one display channel — collect both as structured
  // messages, then render once.
  const warnings = [
    ...findings.filter((f) => f.severity === "warning").map((f) => f.message),
    ...diagnostics.filter((d) => d.severity !== "invalid"),
  ].map((m) => ({ message: renderMessage(m, resolveStageName) }))
  const showMessage = errors.length + warnings.length > 0

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
  logWarnings: Map<string, Diagnostic[]> = new Map(),
): RenderItem[] {
  const items: RenderItem[] = []
  let flatIndex = 0
  const stageLabels = buildStageLabels(slots, loadouts)
  const resolveStageName = (stageId: string): string =>
    stageLabels.get(stageId) ?? stageId

  if (nodes.some((n) => n.kind === "loopMarker")) {
    items.push({ type: "openerHeader" })
  }

  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
    const node = nodes[nodeIndex]
    if (node.kind === "loopMarker") {
      items.push({
        type: "loopMarker",
        markerId: node.id,
        containerIndex: nodeIndex,
      })
      continue
    }
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
        lastCharId: node.entries.at(-1)?.characterId ?? null,
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
              resolveStageName,
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
          resolveStageName,
        ),
      })
    }
  }

  return items
}
