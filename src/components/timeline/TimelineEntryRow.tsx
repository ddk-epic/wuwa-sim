import type { TimelineEntry } from "#/types/timeline"
import type { TimelineSummary } from "#/lib/timeline/timeline-summary"
import { nextVariant } from "#/lib/stage"
import { formatSkillType } from "#/data/skill-types"
import { formatVariantKind } from "#/lib/format-variant-kind"
import { TimeCell, WaitCell, DurationCell, PoolCell } from "./timeline-cells"
import { HexPill } from "#/components/ui/HexPill"
import { DelayBadge } from "#/components/ui/DelayBadge"
import type { TimelineDrag } from "#/hooks/useTimelineDrag"
import type { RenderItem } from "#/lib/timeline/timeline-render-items"

type EntryRenderItem = Extract<RenderItem, { type: "entry" }>

interface TimelineEntryRowProps {
  item: EntryRenderItem
  prevEntry: TimelineEntry | null
  summary: TimelineSummary
  stale?: boolean
  showWait?: boolean
  drag: TimelineDrag
  hidden?: boolean
  onRemove: (id: string) => void
  onUpdateEntry: (id: string, patch: Partial<TimelineEntry>) => void
}

export function TimelineEntryRow({
  item,
  prevEntry,
  summary,
  stale,
  showWait = false,
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
    damageType,
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
    delay: { react: 0, floor: 0, pad: 0, fall: 0, swapBack: 0, priorGate: 0 },
    damage: null,
    cumulativeConcerto: null,
    cumulativeEnergy: null,
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

  const conVal = row.cumulativeConcerto
  const resVal = row.cumulativeEnergy

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
        charSwitched ? "" : "border-gray-800/70",
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
      <TimeCell frames={row.timeFrames} />
      {showWait && (
        <WaitCell
          swapBack={row.delay.swapBack}
          priorGate={row.delay.priorGate}
        />
      )}
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
        {damageType !== null && (
          <HexPill hex={charHex}>{formatSkillType(damageType)}</HexPill>
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
              className="text-micro text-ui-damage px-1 py-0.5 rounded font-mono shrink-0 bg-card border border-border cursor-pointer"
              style={{ letterSpacing: "0.4px" }}
              title="Full / Cancel / Instant Cancel"
            >
              {formatVariantKind(entry.variantKind, "short")}
            </button>
          )}
          <DelayBadge delay={row.delay} className="shrink-0" />
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
      <DurationCell frames={row.durationFrames} />
      <PoolCell value={conVal} color="var(--ui-concerto)" stale={stale} />
      <PoolCell value={resVal} color="var(--ui-resonance)" stale={stale} />
      <td
        className={`px-1 py-2 text-right font-mono${stale ? " opacity-40" : ""}`}
      >
        {row.damage !== null ? (
          <span className="font-semibold text-base text-yellow-400">
            {row.damage.toLocaleString()}
          </span>
        ) : (
          <span className="font-semibold text-gray-600">—</span>
        )}
      </td>
      <td className="px-1 py-2">
        <div className="flex justify-end -my-1">
          <button
            onClick={() => onRemove(entry.id)}
            className="p-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  )
}
