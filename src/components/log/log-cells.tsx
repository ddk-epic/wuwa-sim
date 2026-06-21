import type {
  ActionEvent,
  HitEvent,
  SustainEvent,
} from "#/types/simulation-log"
import type { Element } from "#/data/elements"
import { formatSkillType } from "#/data/skill-types"
import { formatCritCell } from "#/lib/damage/hit-formula"
import { formatFrames } from "#/lib/format"
import { formatVariantKind } from "#/lib/format-variant-kind"
import { HexPill } from "#/components/ui/HexPill"
import { DelayBadge } from "#/components/ui/DelayBadge"
import { WaitBadge } from "#/components/ui/WaitBadge"
import { characterVisual, elementHex } from "#/components/ui/character-visual"

export const numCell = "px-2 py-2 text-right font-mono"
export const COL_COUNT = 14

/** Leading index cell. Pass `caret` (open state) to prefix the expand glyph. */
export function IndexCell({
  index,
  caret,
}: {
  index: number
  caret?: boolean
}) {
  return (
    <td className="px-2 py-2 font-mono text-xs text-right text-muted-foreground">
      {caret !== undefined && (
        <span className="text-muted-foreground/70 mr-1">
          {caret ? "▾" : "▸"}
        </span>
      )}
      {index + 1}
    </td>
  )
}

/** Leading frame cell, accented in the damage color. */
export function FrameCell({ frame }: { frame: number }) {
  return (
    <td className={`${numCell} text-label text-ui-damage`}>
      {formatFrames(frame)}
    </td>
  )
}

/**
 * Wait cell, holding the `WaitBadge` (or empty). Rendered right of the frame
 * only when the log has any wait, so the time column is undisturbed.
 */
export function WaitCell({ wait = 0 }: { wait?: number }) {
  return (
    <td className="px-0 py-2 w-7.5">
      <WaitBadge wait={wait} className="-ml-1.5" />
    </td>
  )
}

/** The six trailing empty stat cells that pad a non-hit row to COL_COUNT. */
export function StatPad() {
  return (
    <>
      <td className={`${numCell} text-xs`} />
      <td className={`${numCell} text-xs`} />
      <td className={`${numCell} text-xs`} />
      <td className={`${numCell} text-xs`} />
      <td className={`${numCell} text-xs`} />
      <td className={`${numCell} text-xs`} />
    </>
  )
}

export function CharChip({ id }: { id: number }) {
  const v = characterVisual(id)
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-xs font-black text-gray-900 shrink-0 ml-1"
      style={{ backgroundColor: v.hex }}
      title={v.name}
    >
      {v.letter}
    </span>
  )
}

export function CharCell({ id }: { id: number }) {
  const v = characterVisual(id)
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-xs font-black text-gray-900 shrink-0"
        style={{ backgroundColor: v.hex }}
      >
        {v.letter}
      </span>
      <span className="text-sm truncate">{v.name}</span>
    </div>
  )
}

export function TypePill({
  characterId,
  skillType,
}: {
  characterId: number
  skillType: string
}) {
  const { hex } = characterVisual(characterId)
  return <HexPill hex={hex}>{formatSkillType(skillType)}</HexPill>
}

export function CritCellValue({
  value,
  warnOverCap = false,
}: {
  value: number
  warnOverCap?: boolean
}) {
  const over = warnOverCap && value > 1
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {over && (
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-label="Crit rate exceeds 100% — excess is wasted"
        >
          <title>Crit rate exceeds 100% — excess is wasted</title>
          <circle
            cx="8"
            cy="8"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-amber-400"
          />
          <path
            d="M8 4v4.5M8 11.25v.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-amber-400"
          />
        </svg>
      )}
      <span>{formatCritCell(value)}</span>
    </span>
  )
}

export function CoordPill({ element }: { element: Element }) {
  const hex = elementHex(element)
  return <HexPill hex={hex}>COORD</HexPill>
}

export function SustainPill({ sub: _sub }: { sub: SustainEvent["sub"] }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono uppercase bg-ui-heal/8 border border-ui-heal/20 text-ui-heal">
      HEAL
    </span>
  )
}

export function SkillNameSuffix({ ev }: { ev: ActionEvent | HitEvent }) {
  if (ev.kind === "action") {
    const label = formatVariantKind(ev.variantKind, "long")
    return (
      <>
        {label && <span className="ml-2 text-sm">{label}</span>}
        <DelayBadge delay={ev.delayBreakdown} className="ml-2" />
      </>
    )
  }
  if (ev.synthetic) {
    return <span> (coord)</span>
  }
  return null
}
