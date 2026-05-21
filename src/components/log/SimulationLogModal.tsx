import { Fragment, useState } from "react"
import type { ReactNode } from "react"
import { XIcon } from "lucide-react"
import type {
  ActiveBuff,
  BuffEvent,
  HitEvent,
  SimulationLogEntry,
} from "#/types/simulation-log"
import { getCharacterById } from "#/lib/loadout/catalog"
import { ELEMENT_HEX } from "#/data/elements"
import { formatSkillType } from "#/data/skill-types"
import {
  computeFormulaBreakdown,
  formatActiveBuffLabel,
  formatCritCell,
  formatDMGPctCell,
  formatDeepenCell,
  formatERCell,
  formatScalingCell,
  formatStatComponents,
} from "#/lib/damage/hit-formula"

const BUFF_KINDS = new Set([
  "buffApplied",
  "buffRefreshed",
  "buffExpired",
  "buffConsumed",
])

interface SimulationLogModalProps {
  log: SimulationLogEntry[]
  onClose: () => void
}

export function SimulationLogModal({ log, onClose }: SimulationLogModalProps) {
  const hitCount = log.filter((e) => e.kind === "hit").length
  const [showBuffs, setShowBuffs] = useState(true)
  const filtered = showBuffs ? log : log.filter((e) => !BUFF_KINDS.has(e.kind))
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-330 max-h-[95vh] bg-card rounded-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-5 pt-4 pb-5">
          <div className="flex items-baseline gap-3 flex-1">
            <span className="text-xl font-semibold text-foreground">
              Simulation Log
            </span>
            <span className="font-mono text-xs text-muted-foreground/70">
              {hitCount} hits
            </span>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none mr-4">
            <input
              type="checkbox"
              checked={showBuffs}
              onChange={(e) => setShowBuffs(e.target.checked)}
            />
            Show buff events
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto px-5 pb-5">
          {log.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              No simulation data. Click Simulate to generate.
            </p>
          ) : (
            <LogTable log={filtered} open={open} onToggle={toggle} />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------- table ----------------

const headerCell = "px-2 py-2 font-mono text-xs tracking-[1px] uppercase"
const numCell = "px-2 py-2 text-right font-mono"
const COL_COUNT = 14

function LogTable({
  log,
  open,
  onToggle,
}: {
  log: SimulationLogEntry[]
  open: Set<number>
  onToggle: (i: number) => void
}) {
  return (
    <table className="w-full text-sm text-left table-fixed min-w-300">
      <thead className="sticky top-0 z-10 bg-darkest border-b border-border">
        <tr className="text-muted-foreground">
          <th className={`${headerCell} text-right w-7.5`}>#</th>
          <th className={`${headerCell} text-right w-18`}>time</th>
          <th className={`${headerCell} w-36`}>char</th>
          <th className={`${headerCell} w-16`}>type</th>
          <th className={headerCell}>skill</th>
          <th className={`${headerCell} text-right w-16`}>con</th>
          <th className={`${headerCell} text-right w-16`}>res</th>
          <th className={`${headerCell} text-right w-22`}>dmg</th>
          <th className={`${headerCell} text-right w-24`}>scale</th>
          <th className={`${headerCell} text-right w-14`}>er</th>
          <th className={`${headerCell} text-right w-16`}>cr</th>
          <th className={`${headerCell} text-right w-16`}>cd</th>
          <th className={`${headerCell} text-right w-14`}>dmg%</th>
          <th className={`${headerCell} text-right w-12`}>deep</th>
        </tr>
      </thead>
      <tbody>
        {log.map((entry, i) => {
          if (isBuff(entry)) {
            return (
              <BuffRow key={i} buff={entry} index={i} colSpan={COL_COUNT} />
            )
          }
          const ev = entry as Hittable
          const isAction = ev.kind === "action"
          const isHit = ev.kind === "hit"
          const h = isHit ? (ev as HitEvent) : null
          const snap = h?.statsSnapshot ?? null
          const isOpen = open.has(i)
          return (
            <Fragment key={i}>
              <tr
                className={`border-t border-border/60 ${isAction ? "" : "text-muted"} ${isHit ? "cursor-pointer hover:bg-gray-800/40" : ""}`}
                onClick={isHit ? () => onToggle(i) : undefined}
              >
                <td className="px-2 py-2 font-mono text-xs text-right text-muted-foreground">
                  {isHit ? (
                    <span className="text-muted-foreground/70 mr-1">
                      {isOpen ? "▾" : "▸"}
                    </span>
                  ) : null}
                  {i + 1}
                </td>
                <td className={`${numCell} text-[16px] text-[#a3bfff]`}>
                  {(ev.frame / 60).toFixed(2)}s
                </td>
                <td className="px-2 py-2">
                  <CharCell id={ev.characterId} />
                </td>
                <td className="px-2 py-2">
                  {isAction && (
                    <TypePill
                      characterId={ev.characterId}
                      skillType={ev.skillType}
                    />
                  )}
                </td>
                <td className="px-2 py-2 truncate">
                  {ev.skillName}
                  <SkillNameSuffix ev={ev} />
                </td>
                <td className={numCell}>
                  {renderPoolValue(ev.cumulativeConcerto, "#f5d061")}
                </td>
                <td className={numCell}>
                  {renderPoolValue(ev.cumulativeEnergy, "#9b6cf0")}
                </td>
                <td className={numCell}>
                  {h ? (
                    <span className="font-semibold text-sm text-yellow-400">
                      {h.damage.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className={`${numCell} text-xs`}>
                  {h && snap ? formatScalingCell(snap, h.scalingStat) : ""}
                </td>
                <td className={`${numCell} text-xs`}>
                  {snap ? formatERCell(snap.energyRechargePct) : ""}
                </td>
                <td className={`${numCell} text-xs`}>
                  {snap ? (
                    <CritCellValue value={snap.critRate} warnOverCap />
                  ) : (
                    ""
                  )}
                </td>
                <td className={`${numCell} text-xs`}>
                  {snap ? <CritCellValue value={snap.critDmg} /> : ""}
                </td>
                <td className={`${numCell} text-xs`}>
                  {h && snap
                    ? formatDMGPctCell(snap, h.element, h.skillType)
                    : ""}
                </td>
                <td className={`${numCell} text-xs`}>
                  {h && snap
                    ? formatDeepenCell(snap, h.element, h.skillType)
                    : ""}
                </td>
              </tr>
              {h && isOpen && (
                <tr className="border-t border-border/40 bg-darkest/60">
                  <td colSpan={COL_COUNT} className="px-3 py-2">
                    <HitDrawer ev={h} />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

// ---------------- drawer ----------------

function HitDrawer({ ev }: { ev: HitEvent }) {
  const snap = ev.statsSnapshot
  const bd = computeFormulaBreakdown(ev)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-1">
        <span className="text-sm text-foreground font-medium">
          {ev.skillName}
        </span>
        <SkillNameSuffix ev={ev} />
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-1.5">
        <div className="flex flex-col gap-1.5">
          <StatCard
            kind="ATK"
            snap={snap}
            highlight={ev.scalingStat ?? "ATK"}
          />
          <StatCard kind="HP" snap={snap} highlight={ev.scalingStat ?? "ATK"} />
          <StatCard
            kind="DEF"
            snap={snap}
            highlight={ev.scalingStat ?? "ATK"}
          />
        </div>

        <div className="flex flex-col gap-1.5 min-w-0">
          <FormulaBox bd={bd} />
          <div className="min-h-25.25 flex flex-col bg-darkest/70 border rounded-lg gap-2 px-3 py-2 font-mono border-border/60">
            <BuffPills label="passive" buffs={ev.passiveBuffs} tint="muted" />
            <BuffPills label="active" buffs={ev.activeBuffs} tint="bright" />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  kind,
  snap,
  highlight,
}: {
  kind: "ATK" | "HP" | "DEF"
  snap: HitEvent["statsSnapshot"]
  highlight: string
}) {
  const text = formatStatComponents(snap, kind)
  const match = text.match(/^([A-Z]+) (\d+) \((.+)\)$/)
  const resolved = match?.[2] ?? text
  const breakdown = match?.[3] ?? ""
  const isHighlight = highlight.toUpperCase() === kind
  return (
    <div className="flex flex-col bg-darkest/70 border rounded-lg px-3 py-1.5 font-mono border-border/60">
      <div className="flex items-baseline gap-2">
        <div className="flex items-center justify-between text-sm uppercase tracking-[1px] text-muted-foreground/70 w-8 shrink-0">
          {kind}
        </div>
        <span
          className={`text-sm ${isHighlight ? "text-yellow-300" : "text-gray-100"}`}
        >
          {resolved}
        </span>
      </div>
      <span className="text-[12px] text-muted-foreground/60 truncate pl-10">
        {breakdown}
      </span>
    </div>
  )
}

function FormulaBox({
  bd,
}: {
  bd: ReturnType<typeof computeFormulaBreakdown>
}) {
  const Term = ({ label, value }: { label: string; value: ReactNode }) => (
    <span className="inline-flex flex-col items-center leading-tight">
      <span className="text-[11px] uppercase tracking-[1px] text-muted-foreground/60">
        {label}
      </span>
      <span>{value}</span>
    </span>
  )
  const Op = ({ s }: { s: string }) => (
    <span className="inline-flex flex-col items-center leading-tight text-muted-foreground/50">
      <span className="text-[12px] tracking-[1px]">&nbsp;</span>
      <span>{s}</span>
    </span>
  )
  return (
    <div className="bg-darkest/70 border border-border/60 rounded-lg px-3 py-2 font-mono text-sm text-muted-foreground">
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <Term label="scale" value={Math.round(bd.scalingValue).toString()} />
        <Op s="×" />
        <Term label="mult" value={bd.multiplier.toFixed(2)} />
        <Op s="×" />
        <Term label="dmg%" value={`(1 + ${(bd.dmgBonus * 100).toFixed(1)}%)`} />
        <Op s="×" />
        <Term label="deepen" value={`(1 + ${(bd.deepen * 100).toFixed(1)}%)`} />
        <Op s="×" />
        <Term label="crit" value={bd.critFactor.toFixed(4)} />
        <Op s="×" />
        <Term label="def" value={bd.defMult.toFixed(4)} />
        <Op s="×" />
        <Term label="res" value={bd.resMult.toFixed(4)} />
        <Op s="=" />
        <Term
          label="damage"
          value={
            <span className="text-yellow-400 font-semibold">
              {bd.result.toLocaleString()}
            </span>
          }
        />
      </div>
    </div>
  )
}

function BuffPills({
  label,
  buffs,
  tint,
}: {
  label: string
  buffs: ActiveBuff[]
  tint: "muted" | "bright"
}) {
  const base =
    tint === "bright"
      ? "bg-blue-400/10 border-blue-500/40 text-blue-400"
      : "bg-card border-border text-muted-foreground"
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[12px] uppercase tracking-[1px] text-muted-foreground/60 w-14 shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
        {buffs.length === 0 ? (
          <span className="text-xs text-muted-foreground/40">—</span>
        ) : (
          buffs.map((b, i) => (
            <span
              key={i}
              className={`px-1.5 py-0.5 rounded text-xs font-mono border ${base}`}
            >
              {formatActiveBuffLabel(b, resolveCharName)}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------- shared cells & helpers ----------------

type Hittable = Extract<SimulationLogEntry, { kind: "action" | "hit" }>

function isBuff(e: SimulationLogEntry): e is BuffEvent {
  return BUFF_KINDS.has(e.kind)
}

function charVisual(id: number) {
  const c = getCharacterById(id)
  const hex = (c?.element && ELEMENT_HEX[c.element]) ?? "#888"
  return { hex, name: c?.name ?? `#${id}`, letter: c?.element[0] ?? "?" }
}

function resolveCharName(id: number): string {
  return getCharacterById(id)?.name ?? `#${id}`
}

function CritCellValue({
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

function SkillNameSuffix({ ev }: { ev: Hittable }) {
  if (ev.kind === "action") {
    const variantLabel =
      ev.variantKind === "cancel"
        ? "(Cancel)"
        : ev.variantKind === "instantCancel"
          ? "(Instant Cancel)"
          : ev.variantKind === "swap"
            ? "(Swap)"
            : null
    const delay = ev.delayBreakdown
    const hasDelay = delay && (delay.react > 0 || delay.pad > 0)
    return (
      <>
        {variantLabel && <span className="ml-2 text-sm">{variantLabel}</span>}
        {hasDelay && (
          <span
            className="ml-2 text-xs text-muted-foreground"
            title={[
              delay.react > 0 ? `react: ${(delay.react / 60).toFixed(2)}s` : "",
              delay.pad > 0 ? `pad: ${(delay.pad / 60).toFixed(2)}s` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            +{((delay.react + delay.pad) / 60).toFixed(2)}s
          </span>
        )}
      </>
    )
  }
  if (ev.synthetic) {
    return <span>(coord)</span>
  }
  return null
}

function CharCell({ id }: { id: number }) {
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

function TypePill({
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

function renderPoolValue(val: number, color: string): ReactNode {
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

function BuffRow({
  buff,
  index,
  colSpan,
}: {
  buff: BuffEvent
  index: number
  colSpan: number
}) {
  const verb =
    buff.kind === "buffApplied"
      ? "applied"
      : buff.kind === "buffRefreshed"
        ? "refreshed"
        : buff.kind === "buffConsumed"
          ? "consumed"
          : "expired"
  const color =
    buff.kind === "buffExpired"
      ? "text-rose-400/70"
      : buff.kind === "buffConsumed"
        ? "text-amber-400/80"
        : "text-emerald-400/80"
  return (
    <tr className="border-t border-border/40 bg-darkest/40">
      <td className="px-2 py-1 font-mono text-xs text-right text-muted-foreground/60">
        {index + 1}
      </td>
      <td className={`${numCell} text-[#a3bfff] text-xs`}>
        {(buff.frame / 60).toFixed(2)}s
      </td>
      <td className="px-2 py-1">
        <CharCell id={buff.targetCharacterId} />
      </td>
      <td className={`py-1 italic text-[12px] ${color}`}>buff {verb}</td>
      <td
        className="px-2 py-1 text-sm text-gray-300"
        colSpan={Math.max(1, colSpan - 4)}
      >
        {buff.buffName}
        {buff.stacks > 1 ? (
          <span className="ml-1 text-muted-foreground/70">× {buff.stacks}</span>
        ) : null}
      </td>
    </tr>
  )
}
