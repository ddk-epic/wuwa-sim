import { Clock } from "lucide-react"
import { getCharacterById } from "#/lib/loadout/catalog"
import { formatSkillType } from "#/data/skill-types"
import { characterVisual } from "#/components/ui/character-visual"
import { TL_RULER_H } from "./BuffTimelineLog"
import type { Char } from "./BuffTimelineLog"
import type { BuffTimelineModel } from "./build-buff-timeline-model"

const SIDEBAR_W = 420

export function BuffTimelineSidebar({
  model,
  hover,
}: {
  model: BuffTimelineModel
  hover: { t: number } | null
}) {
  const { charIds, actionBlocks, buffs, passivesByChar } = model
  const charById = (id: number): Char | undefined => {
    if (!charIds.includes(id)) return undefined
    const v = characterVisual(id)
    return {
      id,
      name: v.name,
      element: v.element,
      hex: v.hex,
      isTeam: v.isTeam,
    }
  }
  const tNow = hover?.t ?? null

  const topBar = (
    <div
      className="flex shrink-0 items-center justify-between border-b border-border bg-darkest px-4"
      style={{ height: TL_RULER_H, boxSizing: "border-box" }}
    >
      <span className="font-mono text-micro uppercase tracking-[1px] text-muted-foreground">
        at time
      </span>
      <span
        className={`font-mono text-stat font-bold tabular-nums ${tNow != null ? "text-ui-damage" : "text-muted-foreground/70"}`}
      >
        {tNow != null ? `${tNow.toFixed(2)}s` : "—"}
      </span>
    </div>
  )

  const shell = (children: React.ReactNode) => (
    <div
      className="flex shrink-0 flex-col border-l border-border bg-darkest"
      style={{ width: SIDEBAR_W }}
    >
      {topBar}
      {children}
    </div>
  )

  if (!hover) {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-7 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/70">
          <Clock size={18} />
        </div>
        <div className="max-w-50 text-detail leading-normal text-muted-foreground">
          Hover over the timeline entries for more action details
        </div>
      </div>,
    )
  }

  const t = hover.t
  const action = actionBlocks.find((c) => t >= c.start && t <= c.end) ?? null
  const live = buffs.filter((b) => t >= b.startTime && t <= b.endTime)
  const actionChar = action ? charById(action.charId) : undefined
  const passives = actionChar ? (passivesByChar.get(actionChar.id) ?? []) : []

  return shell(
    <>
      {/* hero NOW block — current action, subtly tinted in its element color */}
      <div
        className="border-b border-border px-5 py-4"
        style={{
          background:
            action && actionChar
              ? `linear-gradient(135deg, ${actionChar.hex}1c, transparent 70%)`
              : undefined,
        }}
      >
        <div className="font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
          {action ? action.skillCategory : "idle"}
        </div>
        {action && actionChar ? (
          <>
            <div className="mt-0.5 text-wrap text-stat font-extrabold leading-tight text-foreground">
              {action.skillName}
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-detail text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: actionChar.hex }}
              />
              {actionChar.name} · {formatSkillType(action.skillType)}
            </div>
          </>
        ) : (
          <div className="mt-1 text-detail italic text-muted-foreground/70">
            idle / gap
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex justify-between px-5 pb-1.5 pt-2.5">
          <span className="font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
            active buffs
          </span>
          <span className="font-mono text-detail text-muted-foreground">
            {live.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {live.length === 0 && (
            <span className="text-detail text-muted-foreground/70">none</span>
          )}
          <div className="grid grid-cols-2 gap-2">
            {live.map((b) => {
              const c = charById(b.charId)
              const hex = c?.isTeam
                ? characterVisual(b.sourceCharacterId).hex
                : (c?.hex ?? "#888")
              const left = !Number.isFinite(b.endTime)
                ? 1
                : Math.min(
                    1,
                    Math.max(0, (b.endTime - t) / (b.endTime - b.startTime)),
                  )
              return (
                <div
                  key={b.id}
                  className="overflow-hidden rounded-md border border-border bg-foreground/2"
                >
                  <div className="px-2 pt-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: hex }}
                      />
                      <span className="truncate text-micro text-foreground">
                        {b.buffName}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between font-mono text-micro text-muted-foreground/70">
                      <span className="truncate">
                        {characterVisual(b.sourceCharacterId).name}
                      </span>
                      <span className="shrink-0">
                        {Number.isFinite(b.endTime)
                          ? `${Math.max(0, b.endTime - t).toFixed(1)}s`
                          : "∞"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-[3px] bg-border">
                    <div
                      className="h-full"
                      style={{ width: `${left * 100}%`, background: hex }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {actionChar && (
            <>
              <div
                className={`flex justify-between border-t border-border pt-2.5 ${live.length ? "mt-4" : ""}`}
              >
                <span className="font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
                  passive · {actionChar.name}
                </span>
                <span className="font-mono text-detail text-muted-foreground">
                  {passives.length}
                </span>
              </div>
              {passives.length === 0 ? (
                <span className="mt-1.5 block text-detail text-muted-foreground/70">
                  none
                </span>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {passives.map((p) => {
                    const srcName =
                      p.sourceCharacterId != null
                        ? getCharacterById(p.sourceCharacterId)?.name
                        : undefined
                    return (
                      <span
                        key={p.id}
                        className="rounded-full bg-foreground/5 px-2 py-0.5 text-micro text-muted-foreground"
                        title={srcName}
                      >
                        {p.name}
                        {p.stacks > 1 && (
                          <span className="text-muted-foreground/70">
                            {" "}
                            ×{p.stacks}
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>,
  )
}
