import type { SustainEvent } from "#/types/simulation-log"
import { CharCell, SustainPill, numCell } from "./log-cells"
import { formatFrames } from "#/lib/format"

export function SustainEventRow({
  ev,
  index,
}: {
  ev: SustainEvent
  index: number
}) {
  return (
    <tr className="border-t border-border/60">
      <td className="px-2 py-2 font-mono text-xs text-right text-muted-foreground">
        {index + 1}
      </td>
      <td className={`${numCell} text-[16px] text-[#a3bfff]`}>
        {formatFrames(ev.frame)}
      </td>
      <td className="px-2 py-2">
        <CharCell id={ev.characterId} />
      </td>
      <td className="px-2 py-2">
        <SustainPill sub={ev.sub} />
      </td>
      <td className="px-2 py-2 text-muted truncate">{ev.skillName} (heal)</td>
      <td className={numCell}>
        <span className="text-muted-foreground/40">—</span>
      </td>
      <td className={numCell}>
        <span className="text-muted-foreground/40">—</span>
      </td>
      <td className={numCell}>
        <span className="font-semibold text-sm" style={{ color: "#4ade80" }}>
          {ev.amount.toLocaleString()}
        </span>
      </td>
      <td className={`${numCell} text-xs`} />
      <td className={`${numCell} text-xs`} />
      <td className={`${numCell} text-xs`} />
      <td className={`${numCell} text-xs`} />
      <td className={`${numCell} text-xs`} />
      <td className={`${numCell} text-xs`} />
    </tr>
  )
}
