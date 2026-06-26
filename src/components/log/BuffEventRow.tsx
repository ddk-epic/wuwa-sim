import type { BuffEvent, SimulationLogEntry } from "#/types/simulation-log"
import { CharCell, WaitCell, numCell, COL_COUNT } from "./log-cells"
import { formatFrames } from "#/lib/format"

const BUFF_KINDS = new Set([
  "buffApplied",
  "buffRefreshed",
  "buffStacksChanged",
  "buffExpired",
  "buffConsumed",
])

export function isBuff(e: SimulationLogEntry): e is BuffEvent {
  return BUFF_KINDS.has(e.kind)
}

export function BuffEventRow({
  buff,
  index,
  showWait = false,
}: {
  buff: BuffEvent
  index: number
  showWait?: boolean
}) {
  const verb =
    buff.kind === "buffApplied"
      ? "applied"
      : buff.kind === "buffRefreshed"
        ? "refreshed"
        : buff.kind === "buffStacksChanged"
          ? "stacks changed"
          : buff.kind === "buffConsumed"
            ? "consumed"
            : "expired"
  const color =
    buff.kind === "buffExpired"
      ? "text-rose-400/70"
      : buff.kind === "buffConsumed"
        ? "text-amber-400/80"
        : "text-emerald-400/80"
  return (
    <tr className="border-t border-border/40 bg-darkest/40">
      <td className="px-2 py-1 font-mono text-xs text-right text-muted-foreground/60">
        {index + 1}
      </td>
      <td className={`${numCell} text-ui-damage text-label`}>
        {formatFrames(buff.frame)}
      </td>
      {showWait && <WaitCell />}
      <td className="px-2 py-1">
        <CharCell id={buff.targetCharacterId} />
      </td>
      <td className={`py-1 italic text-detail ${color}`}>buff {verb}</td>
      <td
        className="px-2 py-1 text-sm text-gray-300"
        colSpan={Math.max(1, COL_COUNT - 4)}
      >
        {buff.buffName}
        {buff.stacks > 1 ? (
          <span className="ml-1 text-muted-foreground/70">× {buff.stacks}</span>
        ) : null}
      </td>
    </tr>
  )
}
