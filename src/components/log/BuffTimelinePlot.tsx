import { useRef } from "react"
import { formatSkillType } from "#/data/skill-types"
import { TL_LABEL_W, TL_RULER_H, TL_BUFF_LANES } from "./BuffTimelineLog"
import type { Model, ActionBlock, Buff, Char } from "./BuffTimelineLog"

const PX_PER_SEC = 104
const FADE_S = 0.15
const LANE_H = 21

function buffFill(hex: string) {
  return `${hex}33`
}

function ActionLane({
  actions,
  hex,
  px,
  hoverT,
  h,
}: {
  actions: ActionBlock[]
  hex: string
  px: (v: number) => number
  hoverT: number | null
  h: number
}) {
  return (
    <div style={{ paddingTop: h - 1, flexShrink: 0 }}>
      <div className="relative" style={{ height: h, zIndex: 4 }}>
        {actions.map((b, i) => {
          const active = hoverT != null && hoverT >= b.start && hoverT <= b.end
          const dim = hoverT != null && !active
          return (
            <div
              key={i}
              title={`${b.skillName} · ${b.skillType}`}
              className="absolute flex overflow-hidden rounded-[3px] outline outline-darkest transition-[filter,box-shadow] duration-100"
              style={{
                left: px(b.start),
                width: Math.max(px(b.end - b.start), 3),
                minWidth: 40,
                top: 1 - h * (b.laneSpan - 1),
                height: h * b.laneSpan - 2,
                background: hex,
                filter: dim ? "brightness(0.42) saturate(0.55)" : "none",
                boxShadow: active
                  ? `0 0 0 1px #fff8, 0 0 12px ${hex}88`
                  : "none",
                alignItems: b.laneSpan > 1 ? "flex-start" : "center",
                zIndex: active ? 12 : b.laneSpan > 1 ? 6 : 5,
              }}
            >
              <span
                className="overflow-hidden font-mono text-micro font-bold text-darkest whitespace-nowrap text-ellipsis"
                style={{
                  letterSpacing: 0.3,
                  padding: b.laneSpan > 1 ? "3px 5px 0" : "0 5px",
                }}
              >
                {formatSkillType(b.skillType)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BuffLane({
  buff,
  hex,
  px,
  hoverT,
  restStart,
}: {
  buff: Buff
  hex: string
  px: (v: number) => number
  hoverT: number | null
  restStart: number
}) {
  const ht = hoverT
  const active = ht != null && ht >= buff.startTime && ht <= buff.endTime
  const dim = ht != null && !active
  const known = Number.isFinite(buff.endTime)

  const overruns = buff.endTime > restStart + 1e-6
  const renderEnd = overruns ? restStart + FADE_S : buff.endTime
  const solidFrac = Math.min(
    1,
    Math.max(0, (restStart - buff.startTime) / (renderEnd - buff.startTime)),
  )
  const mask = overruns
    ? `linear-gradient(to right, #000 ${(solidFrac * 100).toFixed(1)}%, #0000 100%)`
    : undefined

  let timer = ""
  if (active) {
    timer = known ? `${Math.max(0, buff.endTime - ht).toFixed(1)}s` : "∞"
  } else if (known) {
    timer = `${(buff.endTime - buff.startTime).toFixed(1)}s`
  } else {
    timer = "∞"
  }
  const title = `${buff.buffName} — from ${buff.sourceName} · ${buff.startTime.toFixed(1)}s · ${
    known ? `${(buff.endTime - buff.startTime).toFixed(1)}s` : "permanent"
  }`

  return (
    <div
      title={title}
      className={`absolute top-px bottom-px flex items-center gap-1 overflow-hidden px-1.5 transition-[opacity,box-shadow,border-color] duration-100 ${overruns ? "rounded-l-md" : "rounded-md"}`}
      style={{
        left: px(buff.startTime),
        width: Math.max(px(renderEnd - buff.startTime), 3),
        background: buffFill(hex),
        border: `1px solid ${hex}${active ? "cc" : "66"}`,
        opacity: dim ? 0.45 : 1,
        boxShadow: active
          ? `inset 0 0 0 1px ${hex}55, 0 0 10px ${hex}44`
          : "none",
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    >
      <span
        className="shrink-0 rounded-full"
        style={{
          width: 5,
          height: 5,
          background: hex,
          boxShadow: active ? `0 0 6px ${hex}` : "none",
        }}
      />
      <span
        className={`whitespace-nowrap text-detail ${active ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}
      >
        {buff.buffName}
      </span>
      <span className="shrink-0 font-mono text-micro text-muted-foreground/70">
        {timer}
      </span>
    </div>
  )
}

function EmptyLane({ h }: { h: number }) {
  return (
    <div className="relative" style={{ height: h, flexShrink: 0 }}>
      <div className="absolute inset-x-0 top-1/2 h-px bg-border/40" />
    </div>
  )
}

function CharLabel({
  char,
  buffCount,
  dimmed,
}: {
  char: Char
  buffCount: number
  dimmed: boolean
}) {
  const src = `/portraits/${char.name.toLowerCase()}.png`
  return (
    <div
      className="sticky left-0 z-20 flex shrink-0 flex-col justify-end overflow-hidden border-r border-border bg-background"
      style={{ width: TL_LABEL_W, boxSizing: "border-box" }}
    >
      <div
        className="absolute inset-0 transition-[filter,opacity] duration-100"
        style={{
          backgroundImage: `url("${src}")`,
          backgroundSize: "cover",
          backgroundPosition: "top center",
          filter: dimmed
            ? "grayscale(1) contrast(1.08) brightness(1)"
            : "contrast(1) brightness(1.05) saturate(1.1)",
          opacity: dimmed ? 0.65 : 0.9,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(135% 120% at -10% 44%, ${char.hex}33 0%, ${char.hex}20 40%, ${char.hex}10 70%, transparent 100%)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, var(--color-darkest) 4%, color-mix(in srgb, var(--color-darkest) 85%, transparent) 22%, color-mix(in srgb, var(--color-darkest) 20%, transparent) 50%, transparent 72%)",
        }}
      />
      <div className="relative flex items-end justify-between gap-2 px-3 pb-1.5">
        <div className="min-w-0">
          <div className="text-label font-bold leading-tight text-foreground">
            {char.name}
          </div>
          <div
            className="mt-0.5 font-mono text-micro uppercase tracking-[1.5px]"
            style={{ color: char.hex, textShadow: `0 0 8px ${char.hex}66` }}
          >
            {char.element}
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap font-mono text-micro text-muted-foreground">
          {buffCount} buffs
        </span>
      </div>
    </div>
  )
}

function Grid({
  axisMax,
  px,
  width,
}: {
  axisMax: number
  px: (v: number) => number
  width: number
}) {
  const ticks = Array.from({ length: axisMax + 1 }, (_, s) => s)
  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none z-1"
      style={{ left: TL_LABEL_W, width }}
    >
      {ticks.map((s) => (
        <div
          key={s}
          className={`absolute top-0 bottom-0 w-px ${s % 2 === 0 ? "bg-border" : "bg-border/50"}`}
          style={{ left: px(s) }}
        />
      ))}
    </div>
  )
}

function Ruler({
  axisMax,
  px,
  width,
}: {
  axisMax: number
  px: (v: number) => number
  width: number
}) {
  const ticks: number[] = []
  for (let s = 0; s <= axisMax; s += 2) ticks.push(s)
  return (
    <div
      className="sticky top-0 z-30 flex shrink-0 border-b border-border bg-darkest"
      style={{ width: TL_LABEL_W + width, height: TL_RULER_H }}
    >
      <div
        className="sticky left-0 z-31 flex shrink-0 items-center border-r border-border bg-darkest px-3.5 font-mono text-micro uppercase tracking-[1px] text-muted-foreground"
        style={{ width: TL_LABEL_W, boxSizing: "border-box" }}
      >
        character
      </div>
      <div className="relative" style={{ width }}>
        {ticks.map((s) => (
          <div
            key={s}
            className="absolute top-0 bottom-0 flex items-center"
            style={{
              left: px(s),
              transform: s === 0 ? "none" : "translateX(-50%)",
              paddingLeft: s === 0 ? 6 : 0,
            }}
          >
            <span className="font-mono text-micro text-muted-foreground/70">
              {s}s
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BuffTimelinePlot({
  model,
  hover,
  setHover,
}: {
  model: Model
  hover: { x: number; t: number } | null
  setHover: (h: { x: number; t: number } | null) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { chars, actionBlocks, buffs, axisMax, restStart } = model
  const px = (v: number) => v * PX_PER_SEC
  const plotW = axisMax * PX_PER_SEC

  // The character whose action is live at the hovered time
  const focusedCharId =
    hover != null
      ? (actionBlocks.find((b) => hover.t >= b.start && hover.t <= b.end)
          ?.charId ?? null)
      : null

  const onMove = (e: React.MouseEvent) => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (e.clientX - rect.left < TL_LABEL_W) {
      setHover(null)
      return
    }
    const xLanes = e.clientX - rect.left + el.scrollLeft - TL_LABEL_W
    const t = xLanes / PX_PER_SEC
    if (xLanes < 0 || t > restStart) {
      setHover(null)
      return
    }
    setHover({ x: xLanes, t })
  }

  return (
    <div
      ref={rootRef}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      className="relative flex-1 min-h-0 overflow-auto bg-darkest cursor-crosshair"
    >
      <div className="relative" style={{ width: TL_LABEL_W + plotW }}>
        <Ruler axisMax={axisMax} px={px} width={plotW} />

        <div className="relative" style={{ width: TL_LABEL_W + plotW }}>
          <Grid axisMax={axisMax} px={px} width={plotW} />

          {restStart < axisMax && (
            <div
              className="absolute top-0 bottom-0 z-1 border-l border-dashed border-border"
              style={{
                left: TL_LABEL_W + px(restStart),
                width: px(axisMax - restStart),
                background:
                  "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-background) 85%, transparent) 0 7px, color-mix(in srgb, var(--color-darkest) 85%, transparent) 7px 14px)",
              }}
            />
          )}
          {restStart < axisMax && (
            <div
              className="absolute top-1 z-6 pointer-events-none font-mono text-micro uppercase tracking-[1px] text-muted-foreground/70 whitespace-nowrap"
              style={{ left: TL_LABEL_W + px(restStart) + 6 }}
            >
              rest
            </div>
          )}

          {chars.map((char, ci) => {
            const myActions = actionBlocks.filter((c) => c.charId === char.id)
            const myBuffs = buffs.filter((b) => b.charId === char.id)
            return (
              <div
                key={char.id}
                className="relative z-2 flex"
                style={{
                  width: TL_LABEL_W + plotW,
                  borderTop: ci === 0 ? "none" : `1px solid ${char.hex}33`,
                  background: `linear-gradient(90deg, ${char.hex}12, ${char.hex}05 18%, transparent 32%)`,
                }}
              >
                <CharLabel
                  char={char}
                  buffCount={myBuffs.length}
                  dimmed={focusedCharId != null && focusedCharId !== char.id}
                />
                <div
                  className="relative flex shrink-0 flex-col gap-0.5 py-1"
                  style={{ width: plotW }}
                >
                  <ActionLane
                    actions={myActions}
                    hex={char.hex}
                    px={px}
                    hoverT={hover?.t ?? null}
                    h={LANE_H}
                  />
                  {Array.from({ length: TL_BUFF_LANES }).map((_, laneIdx) => {
                    const laneBuffs = myBuffs.filter((x) => x.lane === laneIdx)
                    return laneBuffs.length === 0 ? (
                      <EmptyLane key={laneIdx} h={LANE_H} />
                    ) : (
                      <div
                        key={laneIdx}
                        className="relative"
                        style={{ height: LANE_H, flexShrink: 0 }}
                      >
                        {laneBuffs.map((b) => (
                          <BuffLane
                            key={b.id}
                            buff={b}
                            hex={char.hex}
                            px={px}
                            hoverT={hover?.t ?? null}
                            restStart={restStart}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {hover && (
            <div
              className="absolute top-0 bottom-0 z-15 w-px pointer-events-none bg-ui-damage"
              style={{
                left: TL_LABEL_W + hover.x,
                boxShadow: "0 0 8px var(--color-ui-damage)",
              }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-ui-damage"
                style={{
                  width: 7,
                  height: 7,
                  boxShadow: "0 0 8px var(--color-ui-damage)",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
