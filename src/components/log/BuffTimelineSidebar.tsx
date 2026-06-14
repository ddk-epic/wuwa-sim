import { getCharacterById } from "#/lib/loadout/catalog"
import { formatSkillType } from "#/data/skill-types"
import { characterVisual } from "#/components/ui/character-visual"
import { EmptyStatement } from "#/components/ui/EmptyStatement"
import { TL_RULER_H } from "./BuffTimelineLog"
import type { Char } from "./BuffTimelineLog"
import type { Buff, BuffTimelineModel } from "./build-buff-timeline-model"

const SIDEBAR_W = 420

const endsAt = (b: Buff, t: number) =>
  Number.isFinite(b.endTime) ? Math.max(0, b.endTime - t) : Infinity

/** Buffs grouped by source character, each group sorted soonest-to-expire. */
function groupBySource(live: Buff[], t: number) {
  const groups: { sourceId: number; buffs: Buff[] }[] = []
  for (const b of live) {
    let g = groups.find((x) => x.sourceId === b.sourceCharacterId)
    if (!g) {
      g = { sourceId: b.sourceCharacterId, buffs: [] }
      groups.push(g)
    }
    g.buffs.push(b)
  }
  for (const g of groups) g.buffs.sort((a, b) => endsAt(a, t) - endsAt(b, t))
  return groups
}

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
      <EmptyStatement
        statement="No action selected"
        description="Hover over the timeline entries for more action details."
      />,
    )
  }

  const t = hover.t
  const action = actionBlocks.find((c) => t >= c.start && t <= c.end) ?? null
  const live = buffs.filter((b) => t >= b.startTime && t <= b.endTime)
  const actionChar = action ? charById(action.charId) : undefined
  const passives = actionChar ? (passivesByChar.get(actionChar.id) ?? []) : []

  return shell(
    <>
      {/* current action, tinted in its element color */}
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
        <div className="flex justify-between overflow-y-hidden px-5 pb-1.5 pt-2.5 [scrollbar-gutter:stable]">
          <span className="font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70">
            active buffs · by source
          </span>
          <span className="font-mono text-detail text-muted-foreground">
            {live.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-scroll px-5 pb-5">
          {live.length === 0 && (
            <div className="mb-3 text-detail text-muted-foreground/70">
              none
            </div>
          )}
          {groupBySource(live, t).map((g) => {
            const src = characterVisual(g.sourceId)
            return (
              <div
                key={g.sourceId}
                className="mb-2.5 overflow-hidden rounded-lg border border-border"
              >
                <div
                  className="flex items-center gap-2 border-b px-3 py-2"
                  style={{
                    background: `${src.hex}12`,
                    borderColor: `${src.hex}2e`,
                  }}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: src.hex }}
                  />
                  <span className="text-detail font-semibold text-foreground">
                    {src.name}
                  </span>
                  <span className="ml-auto font-mono text-micro text-muted-foreground/70">
                    {g.buffs.length} active
                  </span>
                </div>
                <div className="px-3 py-2.5">
                  {g.buffs.map((b) => {
                    const left = !Number.isFinite(b.endTime)
                      ? 1
                      : Math.min(
                          1,
                          Math.max(
                            0,
                            (b.endTime - t) / (b.endTime - b.startTime),
                          ),
                        )
                    return (
                      <div key={b.id} className="mb-2 last:mb-0">
                        <div className="flex items-center gap-2.5">
                          <span className="truncate text-detail text-foreground">
                            {b.buffName}
                          </span>
                          <span className="ml-auto shrink-0 font-mono text-label font-bold tabular-nums text-muted-foreground">
                            {Number.isFinite(b.endTime)
                              ? `${Math.max(0, b.endTime - t).toFixed(1)}s`
                              : "∞"}
                          </span>
                        </div>
                        <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${left * 100}%`,
                              background: src.hex,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

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
                        className="rounded-full bg-foreground/5 px-2 py-0.5 text-detail text-muted-foreground"
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
