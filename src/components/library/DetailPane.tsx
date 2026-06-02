import { useEffect, useRef, useState } from "react"
import {
  CirclePlus,
  Copy,
  Download,
  Layers,
  Pin,
  PinOff,
  Play,
  Trash2,
  Upload,
} from "lucide-react"
import { CharacterPortrait } from "#/components/ui/CharacterPortrait"
import { Card } from "#/components/ui/Card"
import { HBtn } from "#/components/ui/HBtn"
import { IconBtn } from "#/components/ui/IconBtn"
import { Kpi } from "#/components/ui/Kpi"
import { DmgDonut, TypeDistribution } from "./charts"
import { ElementAvatar } from "./portraits"
import { blendGradient, elementHex, portraitSrc } from "./theme"
import type { LibTeam, RowActions } from "./types"

function HeroNameInput({
  initial,
  onCommit,
}: {
  initial: string
  onCommit: (name: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <input
      ref={ref}
      defaultValue={initial}
      aria-label="Team name"
      className="bg-transparent border-b border-gray-600 text-3xl font-bold text-foreground leading-none focus:outline-none focus:border-blue-400"
      style={{ letterSpacing: -0.5 }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(e.currentTarget.value)
        if (e.key === "Escape") {
          e.currentTarget.value = initial
          onCommit(initial)
        }
      }}
      onBlur={(e) => onCommit(e.currentTarget.value)}
    />
  )
}

function DetailHero({ team, actions }: { team: LibTeam; actions: RowActions }) {
  const [editing, setEditing] = useState(false)
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
            className="text-micro text-foreground font-mono tracking-[1.4px] uppercase px-2 py-0.75 border border-border rounded-sm backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            team · {team.id.slice(-6).toUpperCase()}
          </span>
          <span
            className="text-detail text-foreground font-mono tracking-[0.4px] px-2 py-0.75 rounded-sm backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            updated {team.updated}
          </span>
        </div>
      </div>

      {/* Info plate */}
      <div className="px-5.5 pt-4.5 pb-5 flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between gap-4">
          {editing ? (
            <HeroNameInput
              initial={team.name}
              onCommit={(name) => {
                const trimmed = name.trim()
                if (trimmed) actions.onRename(team.id, trimmed)
                setEditing(false)
              }}
            />
          ) : (
            <span
              onClick={() => setEditing(true)}
              title="Rename"
              className="text-3xl font-bold text-foreground leading-none cursor-pointer rounded-sm border border-transparent hover:border-muted px-1 -mx-1"
              style={{ letterSpacing: -0.5 }}
            >
              {team.name}
            </span>
          )}
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
          <div className="flex items-center gap-1.5">
            <IconBtn
              icon={team.pinned ? PinOff : Pin}
              label={team.pinned ? "Unpin" : "Pin"}
              onClick={() => actions.onTogglePin(team.id)}
            />
            <IconBtn
              icon={Download}
              label="Export"
              onClick={() => actions.onExport(team.id)}
            />
            <IconBtn
              icon={Copy}
              label="Duplicate"
              onClick={() => actions.onDuplicate(team.id)}
            />
            <IconBtn
              icon={Trash2}
              label="Delete"
              variant="destructive"
              onClick={() => actions.onDelete(team.id)}
            />
            <HBtn
              icon={Play}
              label="Open to edit"
              primary
              onClick={() => actions.onOpen(team.id)}
            />
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
            className="p-3 flex items-center gap-3"
          >
            <ElementAvatar member={m} size={52} />
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-semibold text-foreground">
                  {m.name}
                </span>
                <span
                  style={{
                    background: `${hex}15`,
                    color: hex,
                    border: `1px solid ${hex}44`,
                  }}
                  className="text-detail px-1 py-px rounded-sm font-mono tracking-[0.4px]"
                >
                  S{m.seq}
                </span>
              </div>
              <span className="text-detail text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                {m.weapon}
              </span>
            </div>
            <div className="text-right flex flex-col gap-0.5">
              <span
                className="text-base font-semibold font-mono tabular-nums"
                style={{ color: "#f5cf4d" }}
              >
                {(share * 100).toFixed(1)}
                <span className="text-base text-muted ml-px">%</span>
              </span>
              <span className="text-detail text-muted font-mono tabular-nums">
                {((team.dmgByChar[m.name] ?? 0) / 1000).toFixed(1)}k
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyMainPane({
  onCreate,
  onImport,
}: {
  onCreate: () => void
  onImport: () => void
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 gap-5.5 min-h-0">
      <div className="w-24 h-24 rounded-full border border-dashed border-border bg-card flex items-center justify-center text-muted relative">
        <Layers size={42} strokeWidth={1.5} />
      </div>
      <div className="flex flex-col gap-2 items-center text-center max-w-110">
        <span
          className="text-stat font-semibold text-foreground"
          style={{ letterSpacing: -0.2 }}
        >
          Your library is empty
        </span>
        <span className="text-sm text-muted leading-[1.55]">
          Build a team in the simulator and save it here.
        </span>
      </div>
      <div className="flex gap-2">
        <HBtn
          icon={CirclePlus}
          label="Create a team"
          primary
          onClick={onCreate}
        />
        <HBtn icon={Upload} label="Import roster" onClick={onImport} />
      </div>
    </div>
  )
}

export function DetailCard({
  team,
  isEmpty,
  actions,
  onCreate,
  onImport,
}: {
  team: LibTeam | null
  isEmpty: boolean
  actions: RowActions
  onCreate: () => void
  onImport: () => void
}) {
  if (isEmpty) return <EmptyMainPane onCreate={onCreate} onImport={onImport} />
  if (!team)
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm italic">
        Select a team from the library
      </div>
    )
  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
      <DetailHero team={team} actions={actions} />
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
