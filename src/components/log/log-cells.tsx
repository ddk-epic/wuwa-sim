import type { ReactNode } from "react"
import type {
  ActionEvent,
  HitEvent,
  SustainEvent,
} from "#/types/simulation-log"
import type { Element } from "#/data/elements"
import { getCharacterById } from "#/lib/loadout/catalog"
import { ELEMENT_HEX } from "#/data/elements"
import { formatSkillType } from "#/data/skill-types"
import { formatCritCell } from "#/lib/damage/hit-formula"
import { formatFrames } from "#/lib/format"
import { formatVariantKind } from "#/lib/format-variant-kind"

export const numCell = "px-2 py-2 text-right font-mono"
export const COL_COUNT = 14

function charVisual(id: number) {
  const c = getCharacterById(id)
  const hex = (c?.element && ELEMENT_HEX[c.element]) ?? "#888"
  return { hex, name: c?.name ?? `#${id}`, letter: c?.element[0] ?? "?" }
}

export function resolveCharName(id: number): string {
  return getCharacterById(id)?.name ?? `#${id}`
}

export function renderPoolValue(val: number | null, color: string): ReactNode {
  if (val === null) return <span style={{ color: "#42475a" }}>—</span>
  if (val === 0) return <span style={{ color: "#42475a" }}>0</span>
  if (val >= 100)
    return (
      <span className="font-bold" style={{ color }}>
        {val.toFixed(1)}
      </span>
    )
  return (
    <span className="font-medium" style={{ color }}>
      {val.toFixed(1)}
    </span>
  )
}

export function CharCell({ id }: { id: number }) {
  const v = charVisual(id)
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
  const { hex } = charVisual(characterId)
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-xs font-mono uppercase"
      style={{
        background: `${hex}15`,
        border: `1px solid ${hex}33`,
        color: hex,
      }}
    >
      {formatSkillType(skillType)}
    </span>
  )
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
  const hex = ELEMENT_HEX[element] ?? "#888"
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-xs font-mono uppercase"
      style={{
        background: `${hex}15`,
        border: `1px solid ${hex}33`,
        color: hex,
      }}
    >
      COORD
    </span>
  )
}

export function SustainPill({ sub: _sub }: { sub: SustainEvent["sub"] }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-xs font-mono uppercase"
      style={{
        background: "#4ade8015",
        border: "1px solid #4ade8033",
        color: "#4ade80",
      }}
    >
      HEAL
    </span>
  )
}

export function SkillNameSuffix({ ev }: { ev: ActionEvent | HitEvent }) {
  if (ev.kind === "action") {
    const label = formatVariantKind(ev.variantKind, "long")
    const delay = ev.delayBreakdown
    const hasDelay =
      delay && (delay.react > 0 || delay.floor > 0 || delay.pad > 0)
    return (
      <>
        {label && <span className="ml-2 text-sm">{label}</span>}
        {hasDelay && (
          <span
            className="ml-2 text-xs text-muted-foreground"
            title={[
              delay.floor > 0
                ? `floor: ${formatFrames(delay.floor)}`
                : delay.react > 0
                  ? `react: ${formatFrames(delay.react)}`
                  : "",
              delay.pad > 0 ? `pad: ${formatFrames(delay.pad)}` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            +{formatFrames(delay.react + delay.floor + delay.pad)}
          </span>
        )}
      </>
    )
  }
  if (ev.synthetic) {
    return <span> (coord)</span>
  }
  return null
}
