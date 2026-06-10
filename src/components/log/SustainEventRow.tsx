import type { SustainEvent } from "#/types/simulation-log"
import {
  CharCell,
  SustainPill,
  numCell,
  IndexCell,
  FrameCell,
  WaitCell,
  StatPad,
} from "./log-cells"

export function SustainEventRow({
  ev,
  index,
  showWait = false,
}: {
  ev: SustainEvent
  index: number
  showWait?: boolean
}) {
  return (
    <tr className="border-t border-border/60">
      <IndexCell index={index} />
      <FrameCell frame={ev.frame} />
      {showWait && <WaitCell />}
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
        <span className="font-semibold text-sm text-ui-heal">
          {ev.amount.toLocaleString()}
        </span>
      </td>
      <StatPad />
    </tr>
  )
}
