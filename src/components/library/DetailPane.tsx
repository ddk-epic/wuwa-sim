import { CirclePlus, Copy, Layers, Play, Upload } from "lucide-react"
import { CharacterPortrait } from "#/components/ui/CharacterPortrait"
import { Card } from "#/components/ui/Card"
import { HBtn } from "#/components/ui/HBtn"
import { Kpi } from "#/components/ui/Kpi"
import { DmgDonut, TypeDistribution } from "./charts"
import { ElementAvatar } from "./portraits"
import { blendGradient, elementHex, portraitSrc } from "./theme"
import type { LibTeam } from "./types"

function DetailHero({ team }: { team: LibTeam }) {
  const dominant = elementHex(
    team.members[team.members.length - 1]?.element ?? "",
  )
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
          {team.members.map((m, i) => (
            <div
              key={i}
              className="flex-1 relative overflow-hidden"
              style={{ opacity: 0.85 }}
            >
              <CharacterPortrait
                src={portraitSrc(m.name)}
                alt=""
                initial={m.name[0]?.toUpperCase() ?? "?"}
                hex={elementHex(m.element)}
                className="w-full h-full object-cover object-[center_42%] block"
              />
            </div>
          ))}
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

function MemberCards({ team }: { team: LibTeam }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {team.members.map((m, i) => {
        const hex = elementHex(m.element)
        const share =
          team.totalDmg > 0 ? (team.dmgByChar[m.name] ?? 0) / team.totalDmg : 0
        return (
          <div
            key={i}
            style={{
              border: `1px solid var(--border)`,
              borderLeft: `2px solid ${hex}`,
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
                    background: `${hex}15`,
                    color: hex,
                    border: `1px solid ${hex}44`,
                  }}
                  className="text-[9px] px-1 py-px rounded-0.5 font-mono tracking-[0.4px]"
                >
                  S{m.seq}
                </span>
              </div>
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

export function DetailCard({
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
