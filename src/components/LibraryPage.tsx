import { useState, useMemo } from "react"
import {
  CirclePlus,
  Play,
  Upload,
  Download,
  Settings,
  Layers,
  Pencil,
  X,
  Copy,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ── Domain color maps ──────────────────────────────────────────────────────────

const ELEMENT: Record<string, { hex: string; letter: string } | undefined> = {
  Fusion: { hex: "#ff7a3d", letter: "F" },
  Glacio: { hex: "#5ad7f0", letter: "G" },
  Electro: { hex: "#b67cff", letter: "E" },
  Aero: { hex: "#5fd49a", letter: "A" },
  Havoc: { hex: "#9b6cf0", letter: "H" },
  Spectro: { hex: "#f5cf4d", letter: "S" },
}

const TYPE_COLORS: Record<string, string> = {
  Intro: "#a3bfff",
  Basic: "#838899",
  Heavy: "#c89b5f",
  Resonance: "#9b6cf0",
  Forte: "#ff7a3d",
  Liberation: "#f5cf4d",
  Echo: "#5ad7f0",
  Outro: "#5fd49a",
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Member {
  name: string
  element: string
  role: string
  seq: number
  weapon: string
}

interface TypeEntry {
  count: number
  dmg: number
}

export interface LibTeam {
  id: string
  name: string
  tag: string
  updated: string
  pinned: boolean
  members: Member[]
  actions: number
  totalTime: number
  totalDmg: number
  dps: number
  concertoEnd: number
  resEnd: number
  dmgByChar: Record<string, number>
  typeMix: Record<string, TypeEntry>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TEXT_OVER_PORTRAIT =
  "0 1px 5px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.65)"

function getPortrait(_name: string): string | null {
  return null
}

function blendGradient(members: Member[], stops?: number[]): string {
  const aHex = (0x10).toString(16).padStart(2, "0")
  const n = members.length
  const stopList = members.map((m, i) => {
    const hex = ELEMENT[m.element]?.hex ?? "#888"
    const pct = stops ? stops[i] : ((i + 0.5) / n) * 75
    return `${hex}${aHex} ${pct.toFixed(1)}%`
  })
  return `linear-gradient(90deg, ${stopList.join(", ")}, transparent 95%)`
}

// ── Atoms ──────────────────────────────────────────────────────────────────────

function IconBtn({
  icon: Icon,
  label,
  onClick,
  size = 13,
  w = 22,
  h = 22,
  className = "",
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  size?: number
  w?: number
  h?: number
  className?: string
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      style={{ width: w, height: h }}
      className={`inline-flex items-center justify-center rounded-sm bg-transparent border-none p-0 cursor-pointer text-muted hover:text-foreground ${className}`}
    >
      <Icon size={size} strokeWidth={1.5} />
    </button>
  )
}

function HBtn({
  icon: Icon,
  label,
  primary,
  kbd,
}: {
  icon?: LucideIcon
  label: string
  primary?: boolean
  kbd?: string
}) {
  return (
    <button
      className={`font-[inherit] text-[11px] px-2.5 py-1.25 pl-2 rounded-sm cursor-pointer whitespace-nowrap inline-flex items-center gap-1.25 border ${
        primary
          ? "bg-[#1a2c4a] text-ui-damage border-[#2a4575]"
          : "bg-transparent hover:bg-darkest text-muted hover:text-foreground border-border"
      }`}
    >
      {Icon && <Icon size={12} strokeWidth={1.5} />}
      <span>{label}</span>
      {kbd && (
        <kbd className="text-[9px] text-ui-damage ml-1 font-mono">{kbd}</kbd>
      )}
    </button>
  )
}

function Kpi({
  label,
  value,
  accent,
  big,
  suffix,
}: {
  label: string
  value: string | number
  accent?: string
  big?: boolean
  suffix?: string
}) {
  return (
    <div className="flex flex-col gap-0.75 min-w-0">
      <span className="text-[9px] text-muted font-mono tracking-px uppercase">
        {label}
      </span>
      <span
        style={{
          fontSize: big ? 22 : 14,
          color: accent ?? "var(--foreground)",
          letterSpacing: -0.4,
        }}
        className="font-semibold font-mono tabular-nums leading-none"
      >
        {value}
        {suffix && (
          <span
            style={{ fontSize: big ? 12 : 10 }}
            className="text-muted ml-0.75 font-medium"
          >
            {suffix}
          </span>
        )}
      </span>
    </div>
  )
}

function ElementAvatar({
  member,
  size = 26,
  dim,
  grayscale,
}: {
  member: Member
  size?: number
  dim?: boolean
  grayscale?: boolean
}) {
  const el = ELEMENT[member.element] ?? { hex: "#888", letter: "?" }
  const src = getPortrait(member.name)
  const ring = `0 0 0 1px ${el.hex}88, 0 1px 3px rgba(0,0,0,.4)`

  if (!src) {
    return (
      <div
        title={`${member.name} · ${member.element}`}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          background: `radial-gradient(circle at 35% 30%, ${el.hex}, ${el.hex}77 60%, var(--background))`,
          boxShadow: ring,
          opacity: dim ? 0.4 : 1,
        }}
        className="flex items-center justify-center shrink-0 text-[#0a0b0d] font-bold text-[12px]"
      >
        {member.name[0]}
      </div>
    )
  }

  return (
    <div
      title={`${member.name} · ${member.element}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: `radial-gradient(circle, ${el.hex}33, var(--card))`,
        boxShadow: ring,
        opacity: dim ? 0.4 : 1,
      }}
      className="shrink-0 overflow-hidden relative"
    >
      <img
        src={src}
        alt={member.name}
        style={{
          filter: grayscale
            ? "grayscale(1) contrast(1.05) brightness(1.05)"
            : "none",
        }}
        className="absolute left-[-8%] top-[-4%] w-[116%] h-[116%] object-cover object-center"
      />
    </div>
  )
}

function ElDot({ element, size = 6 }: { element: string; size?: number }) {
  const hex = ELEMENT[element]?.hex ?? "#888"
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: hex,
        boxShadow: `0 0 6px ${hex}88`,
      }}
      className="inline-block shrink-0"
    />
  )
}

// ── Portrait strip ─────────────────────────────────────────────────────────────

function PortraitStrip({
  members,
  fade = 0.4,
  portraitW = 150,
  portraitH = 150,
  gap = 24,
  leftOffset = 10,
  stripWidth = 540,
  maskStart = 62,
  maskEnd = 96,
  vOffset = 0,
}: {
  members: Member[]
  fade?: number
  portraitW?: number
  portraitH?: number
  gap?: number
  leftOffset?: number
  stripWidth?: number
  maskStart?: number
  maskEnd?: number
  vOffset?: number
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        height: "100%",
        width: stripWidth,
        overflow: "hidden",
        maskImage: `linear-gradient(to right, black 0%, black ${maskStart}%, transparent ${maskEnd}%)`,
        WebkitMaskImage: `linear-gradient(to right, black 0%, black ${maskStart}%, transparent ${maskEnd}%)`,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {members.map((m, i) => {
        const src = getPortrait(m.name)
        const hex = ELEMENT[m.element]?.hex ?? "#888"
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: leftOffset + i * (portraitW + gap),
              top: `calc(50% + ${vOffset}px)`,
              transform: "translateY(-50%)",
              width: portraitW,
              height: portraitH,
              opacity: fade,
            }}
          >
            {src ? (
              <img
                src={src}
                alt=""
                aria-hidden
                className="w-full h-full object-cover object-[center_22%] block"
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: `radial-gradient(circle at 50% 35%, ${hex}88, transparent 70%)`,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Donut chart ────────────────────────────────────────────────────────────────

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
  legend: React.ReactNode
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
          <span className="text-[9px] text-muted font-mono tracking-[1.2px] uppercase">
            {centerLabel}
          </span>
          <span
            className="text-[17px] text-foreground font-semibold font-mono tabular-nums"
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

function DmgDonut({ team }: { team: LibTeam }) {
  const slices = team.members.map((m) => ({
    key: m.name,
    value: team.dmgByChar[m.name] ?? 0,
    color: ELEMENT[m.element]?.hex ?? "#888",
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
        <span className="text-[11px] text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
          {s.key}
        </span>
        <span className="text-2.5 text-muted font-mono tabular-nums">
          {(s.value / 1000).toFixed(1)}k
        </span>
        <span className="text-2.5 text-foreground font-mono tabular-nums min-w-10 text-right">
          {((s.value / total) * 100).toFixed(1)}%
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

function TypeDistribution({ team }: { team: LibTeam }) {
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
        <span className="text-[10.5px] text-foreground font-mono tracking-[0.4px] uppercase">
          {s.key}
        </span>
        <span className="text-2.5 text-muted font-mono tabular-nums">
          {s.count}×
        </span>
        <span className="text-2.5 text-foreground font-mono tabular-nums min-w-10 text-right">
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

// ── Detail hero ────────────────────────────────────────────────────────────────

function DetailHero({ team }: { team: LibTeam }) {
  const dominant =
    ELEMENT[team.members[team.members.length - 1].element]?.hex ?? "#888"
  const STOPS = [16.7, 50, 83.3]

  return (
    <div
      style={{
        border: `1px solid var(--border)`,
        borderTop: `1px solid ${dominant}66`,
        borderRadius: 4,
        background: "var(--card)",
        overflow: "hidden",
        boxShadow: `0 8px 24px rgba(0,0,0,.35), inset 0 0 80px ${dominant}10`,
      }}
      className="relative"
    >
      {/* Portrait region */}
      <div className="relative h-40 overflow-hidden">
        <div
          style={{
            maskImage: "linear-gradient(180deg, black 35%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, black 35%, transparent 100%)",
          }}
          className="absolute inset-0 flex"
        >
          {team.members.map((m, i) => {
            const src = getPortrait(m.name)
            return (
              <div
                key={i}
                className="flex-1 relative overflow-hidden"
                style={{ opacity: 0.85 }}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    aria-hidden
                    className="w-full h-full object-cover object-[center_42%] block"
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: `radial-gradient(circle at 50% 30%, ${ELEMENT[m.element]?.hex ?? "#888"}66, transparent 70%)`,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Whisper blend overlay */}
        <div
          style={{ background: blendGradient(team.members, STOPS) }}
          className="absolute inset-0 pointer-events-none"
        />

        {/* Top badges */}
        <div className="absolute top-3.5 left-4.5 right-4.5 flex items-center justify-between z-2">
          <span
            className="text-[9px] text-foreground font-mono tracking-[1.4px] uppercase px-2 py-0.75 border border-border rounded-0.5 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            team · {team.id.slice(-6).toUpperCase()}
          </span>
          <span
            className="text-2.5 text-foreground font-mono tracking-[0.4px] px-2 py-0.75 rounded-0.5 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            updated {team.updated}
          </span>
        </div>
      </div>

      {/* Info plate */}
      <div className="px-5.5 pt-4.5 pb-5 flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between gap-4">
          <span
            className="text-[26px] font-bold text-foreground leading-none"
            style={{ letterSpacing: -0.5 }}
          >
            {team.name}
          </span>
          <span className="text-2.5 text-muted font-mono tracking-[0.8px] uppercase">
            {team.tag}
          </span>
        </div>
        <div className="flex items-end gap-7">
          <Kpi
            label="dmg"
            value={team.totalDmg.toLocaleString()}
            accent="#f5cf4d"
            big
          />
          <Kpi
            label="dps"
            value={team.dps.toLocaleString()}
            accent="#5ad7f0"
            big
          />
          <Kpi label="time" value={team.totalTime.toFixed(2)} suffix="s" />
          <Kpi label="actions" value={team.actions} />
          <div className="flex-1" />
          <div className="flex gap-1.5">
            <HBtn icon={Play} label="Open in sim" primary />
            <HBtn icon={Copy} label="Duplicate" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Member cards ───────────────────────────────────────────────────────────────

function MemberCards({ team }: { team: LibTeam }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {team.members.map((m, i) => {
        const el = ELEMENT[m.element] ?? { hex: "#888" }
        const share = (team.dmgByChar[m.name] ?? 0) / team.totalDmg
        return (
          <div
            key={i}
            style={{
              border: `1px solid var(--border)`,
              borderLeft: `2px solid ${el.hex}`,
              borderRadius: 3,
              background: "var(--card)",
            }}
            className="p-[12px_14px] flex items-center gap-3"
          >
            <ElementAvatar member={m} size={40} />
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-foreground">
                  {m.name}
                </span>
                <span
                  style={{
                    background: `${el.hex}15`,
                    color: el.hex,
                    border: `1px solid ${el.hex}44`,
                  }}
                  className="text-[9px] px-1 py-px rounded-0.5 font-mono tracking-[0.4px]"
                >
                  S{m.seq}
                </span>
              </div>
              <span className="text-2.5 text-muted font-mono tracking-[0.4px]">
                {m.role}
              </span>
              <span className="text-[9.5px] text-ui-zero whitespace-nowrap overflow-hidden text-ellipsis">
                {m.weapon}
              </span>
            </div>
            <div className="text-right flex flex-col gap-0.5">
              <span
                className="text-[13px] font-semibold font-mono tabular-nums"
                style={{ color: "#f5cf4d" }}
              >
                {(share * 100).toFixed(1)}
                <span className="text-[9px] text-muted ml-px">%</span>
              </span>
              <span className="text-[9.5px] text-muted font-mono tabular-nums">
                {((team.dmgByChar[m.name] ?? 0) / 1000).toFixed(1)}k
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────────

function Card({
  title,
  sub,
  children,
}: {
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-border rounded-sm bg-card flex flex-col min-w-0">
      <div className="px-3.5 py-2.5 border-b border-border flex items-baseline gap-2">
        <span className="text-[11px] font-semibold text-foreground tracking-[0.2px]">
          {title}
        </span>
        {sub && (
          <span className="text-[9.5px] text-muted font-mono tracking-[0.4px]">
            {sub}
          </span>
        )}
      </div>
      <div className="p-3.5 min-w-0">{children}</div>
    </div>
  )
}

// ── Empty states ───────────────────────────────────────────────────────────────

function EmptyMainPane() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 gap-5.5 min-h-0">
      <div className="w-24 h-24 rounded-full border border-dashed border-border bg-card flex items-center justify-center text-muted relative">
        <Layers size={42} strokeWidth={1.5} />
        <div className="absolute -bottom-1.5 -right-1.5 w-7.5 h-7.5 rounded-full bg-[#1a2c4a] border border-[#2a4575] flex items-center justify-center text-ui-damage shadow-[0_4px_12px_rgba(0,0,0,.4)]">
          <CirclePlus size={16} strokeWidth={1.5} />
        </div>
      </div>
      <div className="flex flex-col gap-2 items-center text-center max-w-110">
        <span
          className="text-4.5 font-semibold text-foreground"
          style={{ letterSpacing: -0.2 }}
        >
          Your library is empty
        </span>
        <span className="text-[12px] text-muted leading-[1.55]">
          Build a team in the simulator and save it here. The library shows
          damage breakdowns, skill-type distributions, and per-character
          contribution for every saved comp.
        </span>
      </div>
      <div className="flex gap-2">
        <HBtn icon={CirclePlus} label="Create a team" primary />
        <HBtn icon={Upload} label="Import roster" />
      </div>
      <div className="text-2.5 text-ui-zero font-mono tracking-px uppercase flex items-center gap-1.5">
        <span>or press</span>
        <kbd className="text-[9px] px-1.25 py-px bg-card border border-border rounded-0.5 text-ui-damage">
          N
        </kbd>
        <span>to start</span>
      </div>
    </div>
  )
}

function LibraryEmptyList() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-3 text-center">
      <div className="w-12 h-12 rounded-full border border-dashed border-border flex items-center justify-center text-ui-zero">
        <Layers size={20} strokeWidth={1.5} />
      </div>
      <span className="text-[12px] font-semibold text-foreground">
        No teams yet
      </span>
      <span className="text-[11px] text-muted max-w-60 leading-normal">
        Saved teams from the simulator will appear here.
      </span>
      <div className="mt-1">
        <HBtn icon={CirclePlus} label="New team" primary />
      </div>
    </div>
  )
}

// ── Detail card ────────────────────────────────────────────────────────────────

function DetailCard({
  team,
  isEmpty,
}: {
  team: LibTeam | null
  isEmpty: boolean
}) {
  if (isEmpty) return <EmptyMainPane />
  if (!team)
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-[12px] italic">
        Select a team from the library
      </div>
    )
  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
      <DetailHero team={team} />
      <MemberCards team={team} />
      <div className="grid grid-cols-2 gap-3.5 min-h-0">
        <Card
          title="Damage attribution"
          sub="Per character · contribution share"
        >
          <DmgDonut team={team} />
        </Card>
        <Card title="Skill type distribution" sub="Action count + damage share">
          <TypeDistribution team={team} />
        </Card>
      </div>
    </div>
  )
}

// ── Team tab ───────────────────────────────────────────────────────────────────

const LIBRARY_W = 692

function TeamTab({
  team,
  selected,
  onClick,
}: {
  team: LibTeam
  selected: boolean
  onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  const dominant =
    ELEMENT[team.members[team.members.length - 1].element]?.hex ?? "#888"
  const portraitGap = -6
  const fade = selected ? 0.45 : hov ? 0.36 : 0.3

  const PORTRAIT_W = 148
  const LEFT_OFFSET = 12
  const stops = team.members.map(
    (_, i) =>
      ((LEFT_OFFSET + i * (PORTRAIT_W + portraitGap) + PORTRAIT_W / 2) /
        LIBRARY_W) *
      100,
  )

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: selected
          ? `${blendGradient(team.members, stops)}, linear-gradient(135deg, ${dominant}14, transparent 80%), var(--card)`
          : hov
            ? `${blendGradient(team.members, stops)}, var(--darkest)`
            : blendGradient(team.members, stops),
        borderBottom: "1px solid var(--border)",
        transition: "background .12s",
      }}
      className="relative h-32 cursor-pointer overflow-hidden"
    >
      <PortraitStrip
        members={team.members}
        fade={fade}
        portraitW={PORTRAIT_W}
        portraitH={148}
        gap={portraitGap}
        leftOffset={LEFT_OFFSET}
        stripWidth={520}
        maskStart={58}
        maskEnd={94}
        vOffset={-6}
      />

      {/* KPI gradient backdrop */}
      <div
        className="absolute top-0 right-0 bottom-0 w-62.5 z-2 pointer-events-none"
        style={{
          background:
            "linear-gradient(to left, oklch(0.1456 0.008 273.86) 40%, transparent 100%)",
        }}
      />

      {/* Foreground content */}
      <div
        className="absolute inset-0 z-3 flex"
        style={{ textShadow: TEXT_OVER_PORTRAIT }}
      >
        {/* Left: bottom-aligned text */}
        <div className="flex-1 min-w-0 flex flex-col justify-end pb-3 pt-3.5 pl-5 gap-1.75">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className="text-[19px] font-bold text-foreground leading-[1.1]"
              style={{ letterSpacing: -0.3 }}
            >
              {team.name}
            </span>
            <span className="text-ui-zero text-[11px]">·</span>
            <div className="flex items-center gap-1.75 text-[10.5px] text-muted font-mono">
              {team.members.map((m, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ElDot element={m.element} size={5} />
                  <span>{m.name}</span>
                  {i < team.members.length - 1 && (
                    <span className="text-ui-zero">›</span>
                  )}
                </span>
              ))}
            </div>
            <span className="text-ui-zero text-[11px]">·</span>
            <span className="text-2.5 text-ui-zero font-mono whitespace-nowrap">
              {team.updated}
            </span>
          </div>
        </div>

        {/* Right: vertically centered KPIs */}
        <div className="flex flex-col justify-center items-end gap-2.5 pt-3.5 pb-3 pr-4.5 shrink-0">
          <Kpi
            label="dmg"
            value={team.totalDmg.toLocaleString()}
            accent="#f5cf4d"
            big
          />
          <div className="flex gap-4.5 items-end">
            <Kpi
              label="dps"
              value={team.dps.toLocaleString()}
              accent="#5ad7f0"
            />
            <Kpi label="t" value={`${team.totalTime.toFixed(2)}`} suffix="s" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Library list ───────────────────────────────────────────────────────────────

function LibraryList({
  teams,
  selectedId,
  onSelect,
  query,
  setQuery,
  sort,
  setSort,
}: {
  teams: LibTeam[]
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
  setQuery: (q: string) => void
  sort: string
  setSort: (s: string) => void
}) {
  const isEmpty = teams.length === 0
  const filtered = useMemo(
    () =>
      teams.filter(
        (t) =>
          !query ||
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.members.some((m) =>
            m.name.toLowerCase().includes(query.toLowerCase()),
          ),
      ),
    [teams, query],
  )
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (sort === "dmg") return b.totalDmg - a.totalDmg
        if (sort === "dps") return b.dps - a.dps
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
      }),
    [filtered, sort],
  )

  return (
    <div
      style={{ width: LIBRARY_W }}
      className="shrink-0 border-l border-border bg-darkest flex flex-col min-h-0"
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-border flex items-center gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-semibold">Library</span>
          <span className="text-[11px] text-muted font-mono">
            {isEmpty ? "0" : `${sorted.length}/${teams.length}`}
          </span>
        </div>

        {isEmpty ? (
          <span className="flex-1 text-right text-2.5 text-ui-zero font-mono tracking-[0.6px] uppercase">
            empty
          </span>
        ) : (
          <>
            <label className="flex-1 flex items-center gap-1.5 bg-background border border-border rounded-sm px-2 py-1">
              <Pencil
                size={11}
                strokeWidth={1.5}
                className="text-ui-zero shrink-0"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter teams or members…"
                className="flex-1 bg-transparent border-0 outline-none text-foreground font-[inherit] text-[11px] p-0"
              />
              {query && (
                <IconBtn
                  icon={X}
                  label="Clear"
                  w={16}
                  h={16}
                  size={10}
                  onClick={() => setQuery("")}
                />
              )}
            </label>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-muted font-mono tracking-px uppercase mr-1">
                sort
              </span>
              {["recent", "dmg", "dps"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSort(opt)}
                  style={{
                    border:
                      "1px solid " +
                      (sort === opt ? "var(--border)" : "transparent"),
                  }}
                  className={`text-[9px] px-1.75 py-0.75 rounded-0.5 cursor-pointer font-mono tracking-[0.5px] uppercase ${
                    sort === opt
                      ? "bg-card text-foreground"
                      : "bg-transparent text-muted"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {isEmpty ? (
        <LibraryEmptyList />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {sorted.map((team) => (
            <TeamTab
              key={team.id}
              team={team}
              selected={team.id === selectedId}
              onClick={() => onSelect(team.id)}
            />
          ))}
          {sorted.length === 0 && (
            <div className="p-6 text-center text-muted text-[11px]">
              No teams match "{query}"
            </div>
          )}
        </div>
      )}

      <div className="px-3 py-1.5 border-t border-border text-2.5 text-muted font-mono flex items-center gap-1.5">
        <kbd className="text-[9px] px-1 py-px bg-card border border-border rounded-0.5">
          ↑↓
        </kbd>
        <span>navigate</span>
        <span className="text-ui-zero">·</span>
        <kbd className="text-[9px] px-1 py-px bg-card border border-border rounded-0.5">
          ⏎
        </kbd>
        <span>{isEmpty ? "create" : "load into sim"}</span>
      </div>
    </div>
  )
}

// ── Page frame ─────────────────────────────────────────────────────────────────

export function LibraryPage() {
  const teams: LibTeam[] = []
  const [selectedId, setSelectedId] = useState<string | null>(
    teams[0]?.id ?? null,
  )
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("recent")
  const selectedTeam = teams.find((t) => t.id === selectedId) ?? null
  const isEmpty = teams.length === 0

  return (
    <div className="w-full h-screen bg-background text-foreground font-sans text-[12px] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-13 shrink-0 bg-card border-b border-border flex items-center px-4 gap-4.5">
        <div className="flex items-center gap-2.5">
          <div className="w-5.5 h-5.5 rounded-1.25 bg-[linear-gradient(135deg,#8fb4ff,#3b6fff)] flex items-center justify-center text-[12px] font-extrabold text-[#0a0b0d]">
            S
          </div>
          <span className="text-3.5 font-semibold tracking-[0.4px]">
            SIM/DECK
          </span>
          <span className="text-[9px] text-muted font-mono px-1.75 py-0.5 border border-border rounded-0.5 tracking-[1.2px]">
            LIBRARY
          </span>
        </div>
        <div className="flex-1" />
        <HBtn icon={Upload} label="import" />
        <HBtn icon={Download} label="export" />
        <HBtn icon={CirclePlus} label="New team" primary />
        <IconBtn icon={Settings} label="Settings" />
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left rail */}
        <div className="w-14 shrink-0 bg-darkest border-r border-border flex flex-col items-center py-3 gap-2"></div>

        {/* Main pane */}
        <div className="flex-1 flex flex-col min-w-0">
          <DetailCard team={selectedTeam} isEmpty={isEmpty} />
        </div>

        {/* Library list */}
        <LibraryList
          teams={teams}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query}
          setQuery={setQuery}
          sort={sort}
          setSort={setSort}
        />
      </div>
    </div>
  )
}
