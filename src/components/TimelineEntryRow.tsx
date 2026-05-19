import type { TimelineEntry } from "#/types/timeline"
import type { VariantKind } from "#/types/character"
import type { TimelineSummary } from "#/lib/timeline-summary"
import type { SimulationLogEntry } from "#/types/simulation-log"
import type { ValidationResult } from "#/lib/validate-timeline"
import type { ActionTimeStage } from "#/lib/stage"
import { ELEMENT_HEX } from "#/data/elements"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import { getCharacterById } from "#/lib/catalog"
import { findStageByEntry, resolveStageExecution } from "#/lib/stage"
import type { TimelineDrag } from "#/hooks/useTimelineDrag"
import { useReactionDelay, useSwapFrames } from "#/hooks/useSettingsContext"
import { useTeamContext } from "#/hooks/useTeamContext"

const VARIANT_ORDER: (VariantKind | undefined)[] = [
  undefined,
  "cancel",
  "instantCancel",
  "swap",
]

function nextVariant(
  current: VariantKind | undefined,
  stage: ActionTimeStage,
): VariantKind | undefined {
  const defined = VARIANT_ORDER.filter(
    (v) => v === undefined || stage.variants?.[v] !== undefined,
  )
  const idx = defined.indexOf(current)
  return defined[(idx + 1) % defined.length]
}

function variantLabel(v: VariantKind | undefined): string {
  if (v === "cancel") return "CNCL"
  if (v === "instantCancel") return "INST"
  if (v === "swap") return "SWAP"
  return "FULL"
}

export function renderPoolValue(val: number | null, activeColor: string) {
  if (val === null) return <span style={{ color: "#42475a" }}>—</span>
  if (val === 0) return <span style={{ color: "#42475a" }}>0</span>
  if (val >= 100)
    return (
      <span className="font-bold" style={{ color: activeColor }}>
        {val.toFixed(1)}
      </span>
    )
  return (
    <span className="font-medium" style={{ color: activeColor }}>
      {val.toFixed(1)}
    </span>
  )
}

interface TimelineEntryRowProps {
  entry: TimelineEntry
  index: number
  inGroup: boolean
  groupId: string | null
  groupLocked: boolean
  isLastInGroup: boolean
  lastInGroupGradient: string | null
  groupFirstCharHex: string | null
  prevEntry: TimelineEntry | null
  summary: TimelineSummary
  validation: ValidationResult
  showMessage: boolean
  actionEventAtIndex:
    | Extract<SimulationLogEntry, { kind: "action" }>
    | undefined
  drag: TimelineDrag
  onRemove: (id: string) => void
  onUpdateEntry: (id: string, patch: Partial<TimelineEntry>) => void
}

export function TimelineEntryRow({
  entry,
  index,
  inGroup,
  groupId,
  groupLocked,
  isLastInGroup,
  lastInGroupGradient,
  groupFirstCharHex,
  prevEntry,
  summary,
  validation,
  showMessage,
  actionEventAtIndex,
  drag,
  onRemove,
  onUpdateEntry,
}: TimelineEntryRowProps) {
  const reactionDelay = useReactionDelay()
  const swapFrames = useSwapFrames()
  const { slots, loadouts } = useTeamContext()
  const char = getCharacterById(entry.characterId)
  const row = summary.rows[index] ?? { time: 0, damage: null }
  const isInvalid = validation.invalidRowIds.has(entry.id)
  const errors = validation.rowErrors.get(entry.id) ?? []
  const warnings = validation.rowWarnings.get(entry.id) ?? []
  const isDragging = drag.draggedId === entry.id
  const isDropTarget = drag.dropTargetId === entry.id
  const resolved = findStageByEntry(entry, slots, loadouts)
  const stageWithVariants =
    resolved !== null &&
    resolved.stage.variants !== undefined &&
    Object.keys(resolved.stage.variants).length > 0
      ? resolved.stage
      : null
  const source = drag.entrySource(entry.id, { groupId, locked: groupLocked })
  const target = drag.entryTarget(entry.id, { groupId, groupLocked })

  const charElement = char?.element
  const charHex = (charElement && ELEMENT_HEX[charElement]) ?? "#888"
  const elementLetter = charElement?.[0] ?? "?"

  const duration = resolved
    ? resolveStageExecution(
        resolved.stage,
        entry.variantKind,
        reactionDelay,
        swapFrames,
      ).advance / 60
    : 0

  const conVal = actionEventAtIndex?.cumulativeConcerto ?? null
  const resVal = actionEventAtIndex?.cumulativeEnergy ?? null

  const charSwitched =
    prevEntry === null || prevEntry.characterId !== entry.characterId
  const rowStyle: React.CSSProperties = {
    ...(charSwitched ? { borderTopColor: `${charHex}33` } : {}),
    ...(lastInGroupGradient !== null
      ? {
          backgroundImage: lastInGroupGradient,
          backgroundSize: "100% 6px",
          backgroundPosition: "bottom",
          backgroundRepeat: "no-repeat",
        }
      : {}),
  }

  return (
    <tr
      draggable
      onDragStart={source.onDragStart}
      onDragOver={target.onDragOver}
      onDrop={target.onDrop}
      onDragEnd={source.onDragEnd}
      className={[
        "border-t cursor-grab",
        charSwitched ? "" : "border-gray-700",
        isDragging ? "opacity-40" : "hover:bg-gray-800/50",
        isDropTarget ? "border-t-blue-500 border-t-2" : "",
        isInvalid ? "bg-red-950/30" : "",
      ].join(" ")}
      style={rowStyle}
    >
      <td className="px-2 py-2 font-mono text-xs text-right w-8">
        {inGroup ? (
          <span
            className="font-light text-sm ml-1.5 mr-1"
            style={
              groupFirstCharHex !== null
                ? { color: `${groupFirstCharHex}6a` }
                : undefined
            }
          >
            {isLastInGroup ? "└" : "├"}
          </span>
        ) : null}
        <span className="text-gray-400">{index + 1}</span>
      </td>
      <td className="px-2 py-2 text-right font-mono text-[16px] text-[#a3bfff]">
        {row.time.toFixed(2)}s
      </td>
      <td className="px-2 py-2 text-white overflow-hidden">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-xs font-black text-gray-900 shrink-0"
            style={{ backgroundColor: charHex }}
          >
            {elementLetter}
          </span>
          <span className="text-sm truncate">{char?.name ?? "—"}</span>
        </div>
      </td>
      <td className="px-2 py-2">
        {resolved && (
          <span
            className="inline-block px-1.5 py-0.5 rounded text-xs font-mono uppercase"
            style={{
              background: `${charHex}15`,
              border: `1px solid ${charHex}33`,
              color: charHex,
            }}
          >
            {STAGE_TYPE_LABELS[resolved.skillType] ?? resolved.skillType}
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-gray-200 overflow-hidden">
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <span
            className={`truncate min-w-0 ${isInvalid ? "text-red-400" : ""}`}
            title={isInvalid ? "red-marker" : undefined}
          >
            {resolved?.skillName ?? "—"}
          </span>
          {stageWithVariants && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onUpdateEntry(entry.id, {
                  variantKind: nextVariant(
                    entry.variantKind,
                    stageWithVariants,
                  ),
                })
              }}
              className="text-[12px] px-1 py-0.5 rounded font-mono shrink-0 bg-card border border-border"
              style={{ color: "#a3bfff", letterSpacing: "0.4px" }}
              title="Full / Cancel / Instant Cancel"
            >
              {variantLabel(entry.variantKind)}
            </button>
          )}
          {showMessage && errors.length > 0 && (
            <span className="text-xs text-red-400">{errors[0].message}</span>
          )}
          {showMessage && warnings.length > 0 && errors.length === 0 && (
            <span className="text-xs text-yellow-400">
              {warnings[0].message}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 text-right font-mono text-[16px] text-gray-300">
        {duration.toFixed(2)}s
      </td>
      <td className="px-2 py-2 text-right font-mono">
        {renderPoolValue(conVal, "#f5d061")}
      </td>
      <td className="px-2 py-2 text-right font-mono">
        {renderPoolValue(resVal, "#9b6cf0")}
      </td>
      <td className="px-2 py-2 text-right font-mono">
        {row.damage !== null ? (
          <span className="font-semibold text-[19px] text-yellow-400">
            {row.damage.toLocaleString()}
          </span>
        ) : (
          <span className="font-semibold text-gray-600">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end">
          <button
            onClick={() => onRemove(entry.id)}
            className="p-1.5 -my-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  )
}
