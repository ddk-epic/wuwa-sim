import { useMemo, useState } from "react"
import { CirclePlus, Layers, Pencil, X } from "lucide-react"
import { IconBtn } from "#/components/ui/IconBtn"
import { HBtn } from "#/components/ui/HBtn"
import { Kpi } from "#/components/ui/Kpi"
import { ElDot } from "#/components/ui/ElDot"
import { PortraitStrip } from "./portraits"
import { blendGradient, elementHex, TEXT_OVER_PORTRAIT } from "./theme"
import type { LibTeam } from "./types"

export const LIBRARY_W = 692

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
  const dominant = elementHex(
    team.members[team.members.length - 1]?.element ?? "",
  )
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

export function LibraryList({
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
