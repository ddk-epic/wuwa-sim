import { Clock } from "lucide-react"
import { getCharacterById } from "#/lib/loadout/catalog"
import { formatSkillType } from "#/data/skill-types"
import { characterVisual } from "#/components/ui/character-visual"
import { TL_RULER_H } from "./BuffTimelineLog"
import type { Char } from "./BuffTimelineLog"
import type { BuffTimelineModel } from "./build-buff-timeline-model"

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
    return { id, name: v.name, element: v.element, hex: v.hex }
  }
  const tNow = hover?.t ?? null

  const topBar = (
    <div
      className="flex shrink-0 items-center justify-between border-b border-border bg-darkest px-3.5"
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
      style={{ width: 280 }}
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
      <div className="border-b border-border px-3.5 py-2.5">
        <div className="mb-2.5 font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
          action
        </div>
        {action && actionChar ? (
          <div
            className="flex items-center pl-2.5"
            style={{ borderLeft: `3px solid ${actionChar.hex}` }}
          >
            <div className="min-w-0">
              <div className="truncate text-label font-bold text-foreground">
                {action.skillName}
              </div>
              <div className="mt-0.5 font-mono text-micro tracking-[0.3px] text-muted-foreground">
                {actionChar.name} · {formatSkillType(action.skillType)}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-detail italic text-muted-foreground/70">
            idle / gap
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex justify-between px-3.5 pt-2 pb-1.5">
          <span className="font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
            active buffs
          </span>
          <span className="font-mono text-detail text-muted-foreground">
            {live.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3.5 pb-3">
          {live.length === 0 && (
            <span className="text-detail text-muted-foreground/70">none</span>
          )}
          {live.map((b) => {
            const c = charById(b.charId)
            const hex = c?.hex ?? "#888"
            const prog = !Number.isFinite(b.endTime)
              ? 0
              : Math.min(
                  1,
                  Math.max(0, (t - b.startTime) / (b.endTime - b.startTime)),
                )
            return (
              <div key={b.id} className="mb-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: hex }}
                  />
                  <span className="truncate text-detail text-foreground">
                    {b.buffName}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-micro text-muted-foreground/70">
                    {Number.isFinite(b.endTime)
                      ? `${Math.max(0, b.endTime - t).toFixed(1)}s`
                      : "∞"}
                  </span>
                </div>
                <div className="ml-3 h-[3px] overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(1 - prog) * 100}%`, background: hex }}
                  />
                </div>
                <div className="ml-3 mt-0.5 font-mono text-micro text-muted-foreground/70">
                  {characterVisual(b.sourceCharacterId).name}
                </div>
              </div>
            )
          })}

          {actionChar && (
            <>
              <div
                className={`flex justify-between border-t border-border pt-2.5 ${live.length ? "mt-3" : ""}`}
              >
                <span className="font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
                  passive · {actionChar.name}
                </span>
                <span className="font-mono text-detail text-muted-foreground">
                  {passives.length}
                </span>
              </div>
              {passives.length === 0 && (
                <span className="mt-1.5 block text-detail text-muted-foreground/70">
                  none
                </span>
              )}
              <div className="mt-2">
                {passives.map((p) => {
                  const srcName =
                    p.sourceCharacterId != null
                      ? getCharacterById(p.sourceCharacterId)?.name
                      : undefined
                  return (
                    <div
                      key={p.id}
                      className="mb-1.5 flex items-center gap-1.5"
                    >
                      <span className="h-[5px] w-[5px] shrink-0 rounded-[1px] bg-muted-foreground/70" />
                      <span className="truncate text-detail text-muted-foreground">
                        {p.name}
                        {p.stacks > 1 && (
                          <span className="font-mono text-muted-foreground/70">
                            {" "}
                            ×{p.stacks}
                          </span>
                        )}
                      </span>
                      {srcName && (
                        <span className="ml-auto shrink-0 font-mono text-micro text-muted-foreground/70">
                          {srcName}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>,
  )
}
