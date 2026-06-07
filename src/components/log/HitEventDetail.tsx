import type { ReactNode } from "react"
import type { ActiveBuff, HitEvent } from "#/types/simulation-log"
import {
  computeFormulaBreakdown,
  formatActiveBuffLabel,
  formatStatComponents,
} from "#/lib/damage/hit-formula"
import { SkillNameSuffix, resolveCharName } from "./log-cells"

export function HitEventDetail({ ev }: { ev: HitEvent }) {
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
      <span className="text-detail text-muted-foreground/60 truncate pl-10">
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
      <span className="text-detail uppercase tracking-[1px] text-muted-foreground/60">
        {label}
      </span>
      <span>{value}</span>
    </span>
  )
  const Op = ({ s }: { s: string }) => (
    <span className="inline-flex flex-col items-center leading-tight text-muted-foreground/50">
      <span className="text-detail tracking-[1px]">&nbsp;</span>
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
        <Term label="amp" value={`(1 + ${(bd.amp * 100).toFixed(1)}%)`} />
        <Op s="×" />
        {bd.vul !== 0 && (
          <>
            <Term label="vul" value={`(1 + ${(bd.vul * 100).toFixed(1)}%)`} />
            <Op s="×" />
          </>
        )}
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
      <span className="text-detail uppercase tracking-[1px] text-muted-foreground/60 w-14 shrink-0">
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
