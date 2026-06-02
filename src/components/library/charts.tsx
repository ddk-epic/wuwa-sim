import type { ReactNode } from "react"
import { elementHex, TYPE_COLORS } from "./theme"
import type { LibTeam } from "./types"

function Donut({
  slices,
  total,
  centerLabel,
  centerValue,
  legend,
  size = 130,
}: {
  slices: { key: string; value: number; color: string }[]
  total: number
  centerLabel: string
  centerValue: string | number
  legend: ReactNode
  size?: number
}) {
  const r = Math.round(size * 0.38)
  const stroke = Math.round(size * 0.12)
  const cx = size / 2
  const cy = size / 2
  const C = 2 * Math.PI * r
  let acc = 0
  const arcs = slices.map((s) => {
    const frac = total > 0 ? s.value / total : 0
    const len = frac * C
    const offset = -acc
    acc += len
    return { ...s, len, offset }
  })

  return (
    <div className="flex gap-4.5 items-center py-1 px-0.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--background)"
            strokeWidth={stroke}
          />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={`${a.len} ${C - a.len}`}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-micro text-muted font-mono tracking-[1.2px] uppercase">
            {centerLabel}
          </span>
          <span
            className="text-stat text-foreground font-semibold font-mono tabular-nums"
            style={{ letterSpacing: -0.4 }}
          >
            {centerValue}
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1.25">{legend}</div>
    </div>
  )
}

/** Per-character damage contribution donut, reading `team.dmgByChar` (keyed by name). */
export function DmgDonut({ team }: { team: LibTeam }) {
  const slices = team.members.map((m) => ({
    key: m.name,
    value: team.dmgByChar[m.name] ?? 0,
    color: elementHex(m.element),
  }))
  const total = team.totalDmg
  const legend = [...slices]
    .sort((a, b) => b.value - a.value)
    .map((s) => (
      <div
        key={s.key}
        className="grid items-center gap-2 py-0.5"
        style={{ gridTemplateColumns: "10px 1fr auto auto" }}
      >
        <span
          className="w-2 h-2 rounded-px block"
          style={{ background: s.color }}
        />
        <span className="text-label text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
          {s.key}
        </span>
        <span className="text-detail text-muted font-mono tabular-nums">
          {(s.value / 1000).toFixed(1)}k
        </span>
        <span className="text-detail text-foreground font-mono tabular-nums min-w-10 text-right">
          {total > 0 ? ((s.value / total) * 100).toFixed(1) : "0.0"}%
        </span>
      </div>
    ))
  return (
    <Donut
      slices={slices}
      total={total}
      centerLabel="dmg"
      centerValue={`${(total / 1000).toFixed(0)}k`}
      legend={legend}
    />
  )
}

/** Skill-type distribution donut, reading `team.typeMix` ({ count, dmg } by Skill Type). */
export function TypeDistribution({ team }: { team: LibTeam }) {
  const entries = Object.entries(team.typeMix).filter(([, v]) => v.count > 0)
  const slices = entries.map(([k, v]) => ({
    key: k,
    value: v.dmg,
    color: TYPE_COLORS[k] ?? "var(--muted)",
  }))
  const total = slices.reduce((s, x) => s + x.value, 0)
  const withMeta = entries.map(([k, v]) => ({
    key: k,
    ...v,
    color: TYPE_COLORS[k] ?? "var(--muted)",
  }))
  const legend = [...withMeta]
    .sort((a, b) => b.dmg - a.dmg)
    .map((s) => (
      <div
        key={s.key}
        className="grid items-center gap-2 py-0.5"
        style={{ gridTemplateColumns: "10px 1fr auto auto" }}
      >
        <span
          className="w-2 h-2 rounded-px block"
          style={{ background: s.color }}
        />
        <span className="text-detail text-foreground font-mono tracking-[0.4px] uppercase">
          {s.key}
        </span>
        <span className="text-detail text-muted font-mono tabular-nums">
          {s.count}×
        </span>
        <span className="text-detail text-foreground font-mono tabular-nums min-w-10 text-right">
          {total > 0 ? ((s.dmg / total) * 100).toFixed(1) : "0.0"}%
        </span>
      </div>
    ))
  return (
    <Donut
      slices={slices}
      total={total}
      centerLabel="dmg"
      centerValue={`${(total / 1000).toFixed(0)}k`}
      legend={legend}
    />
  )
}
