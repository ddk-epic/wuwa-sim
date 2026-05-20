import type { TimelineEntry } from "#/types/timeline"
import type { VariantKind } from "#/types/character"
import type { TimelineSummary } from "#/lib/timeline-summary"
import type { SimulationLogEntry } from "#/types/simulation-log"
import type { ActionTimeStage } from "#/lib/stage"
import { STAGE_TYPE_LABELS } from "#/data/skill-types"
import type { TimelineDrag } from "#/hooks/useTimelineDrag"
import type { RenderItem } from "#/lib/timeline-render-items"

const VARIANT_ORDER: (VariantKind | undefined)[] = [
  undefined,
  "cancel",
  "instantCancel",
  "swap",
]

export function nextVariant(
  current: VariantKind | undefined,
  stage: ActionTimeStage,
): VariantKind | undefined {
  const defined = VARIANT_ORDER.filter(
    (v) => v === undefined || stage.variants?.[v] !== undefined,
  )
  const idx = defined.indexOf(current)
  return defined[(idx + 1) % defined.length]
}

export function variantLabel(v: VariantKind | undefined): string {
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

type EntryRenderItem = Extract<RenderItem, { type: "entry" }>

interface TimelineEntryRowProps {
  item: EntryRenderItem
  prevEntry: TimelineEntry | null
  summary: TimelineSummary
  actionEventAtIndex:
    | Extract<SimulationLogEntry, { kind: "action" }>
    | undefined
  drag: TimelineDrag
  hidden?: boolean
  onRemove: (id: string) => void
  onUpdateEntry: (id: string, patch: Partial<TimelineEntry>) => void
}

export function TimelineEntryRow({
  item,
  prevEntry,
  summary,
  actionEventAtIndex,
  drag,
  hidden = false,
  onRemove,
  onUpdateEntry,
}: TimelineEntryRowProps) {
  const {
    entry,
    flatIndex: index,
    inGroup,
    groupId,
    groupLocked,
    isLastInGroup,
    lastInGroupGradient,
    groupFirstCharHex,
    charName,
    charHex,
    elementLetter,
    skillType,
    skillName,
    stageWithVariants,
    isInvalid,
    errors,
    warnings,
    showMessage,
    containerIndex,
  } = item
  const row = summary.rows[index] ?? {
    timeFrames: 0,
    durationFrames: 0,
    reactFrames: 0,
    padFrames: 0,
    damage: null,
  }
  const isDragging = drag.draggedId === entry.id
  const source = drag.entrySource(
    entry.id,
    { groupId, locked: groupLocked },
    containerIndex,
  )
  const target = drag.entryTarget(
    entry.id,
    { groupId, groupLocked },
    containerIndex,
  )

  const duration = row.durationFrames / 60
  const reactDelayFrames = row.reactFrames
  const padFrames = row.padFrames
  const totalDelayFrames = reactDelayFrames + padFrames

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
    ...(hidden ? { display: "none" } : {}),
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
        {(row.timeFrames / 60).toFixed(2)}s
      </td>
      <td className="px-2 py-2 text-white overflow-hidden">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-xs font-black text-gray-900 shrink-0"
            style={{ backgroundColor: charHex }}
          >
            {elementLetter}
          </span>
          <span className="text-sm truncate">{charName}</span>
        </div>
      </td>
      <td className="px-2 py-2">
        {skillType !== null && (
          <span
            className="inline-block px-1.5 py-0.5 rounded text-xs font-mono uppercase"
            style={{
              background: `${charHex}15`,
              border: `1px solid ${charHex}33`,
              color: charHex,
            }}
          >
            {(STAGE_TYPE_LABELS as Record<string, string | undefined>)[
              skillType
            ] ?? skillType}
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-gray-200 overflow-hidden">
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <span
            className={`truncate min-w-0 ${isInvalid ? "text-red-400" : ""}`}
            title={isInvalid ? "red-marker" : undefined}
          >
            {skillName ?? "—"}
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
          {totalDelayFrames > 0 && (
            <span
              className="text-xs text-gray-500 shrink-0"
              title={[
                reactDelayFrames > 0
                  ? `react: ${(reactDelayFrames / 60).toFixed(2)}s`
                  : "",
                padFrames > 0 ? `pad: ${(padFrames / 60).toFixed(2)}s` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              +{(totalDelayFrames / 60).toFixed(2)}s
            </span>
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
