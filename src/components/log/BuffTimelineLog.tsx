import { useEffect, useMemo, useState } from "react"
import type { SimulationLogEntry } from "#/types/simulation-log"
import { buildBuffTimelineModel, FPS } from "./build-buff-timeline-model"
import { BuffTimelinePlot } from "./BuffTimelinePlot"
import { BuffTimelineSidebar } from "./BuffTimelineSidebar"

export const TL_LABEL_W = 188
export const TL_RULER_H = 34

/** View-side character visuals, hydrated by id from the id-only model. */
export type Char = {
  id: number
  name: string
  element: string
  hex: string
  isTeam: boolean
}

export function BuffTimelineLog({
  log,
  rosterIds,
}: {
  log: SimulationLogEntry[]
  rosterIds: number[]
}) {
  const model = useMemo(
    () => buildBuffTimelineModel(log, rosterIds),
    [log, rosterIds],
  )
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null)
  // Reset to the clean prompt when the model changes (re-sim / roster change).
  useEffect(() => setHover(null), [model])

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden rounded-xl border border-border bg-darkest">
      <BuffTimelinePlot model={model} hover={hover} setHover={setHover} />
      <BuffTimelineSidebar model={model} hover={hover} />
    </div>
  )
}

export function BuffTimelineKpis({
  totalDamage,
  dps,
  totalTimeFrames,
}: {
  totalDamage: number
  dps: number
  totalTimeFrames: number
}) {
  const kpi = (label: string, value: string, valueClass: string) => (
    <div className="flex flex-col items-end">
      <span className={`font-mono font-bold ${valueClass}`}>{value}</span>
      <span className="font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
        {label}
      </span>
    </div>
  )
  return (
    <div className="flex items-baseline gap-4">
      {kpi("dmg", totalDamage.toLocaleString(), "text-stat text-spectro")}
      {kpi("dps", dps.toLocaleString(), "text-label text-glacio")}
      {kpi("time", `${(totalTimeFrames / FPS).toFixed(2)}s`, "text-label")}
    </div>
  )
}
