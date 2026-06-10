import type { ActionEvent } from "#/types/simulation-log"
import {
  CharCell,
  TypePill,
  SkillNameSuffix,
  numCell,
  IndexCell,
  FrameCell,
  WaitCell,
  StatPad,
} from "./log-cells"
import { PoolValue } from "../ui/PoolValue"

export function ActionEventRow({
  ev,
  index,
  showWait = false,
}: {
  ev: ActionEvent
  index: number
  showWait?: boolean
}) {
  return (
    <tr className="border-t border-border/60">
      <IndexCell index={index} />
      <FrameCell frame={ev.frame} />
      {showWait && <WaitCell priorGate={ev.delayBreakdown?.priorGate} />}
      <td className="px-2 py-2">
        <CharCell id={ev.characterId} />
      </td>
      <td className="px-2 py-2">
        <TypePill characterId={ev.characterId} skillType={ev.skillType} />
      </td>
      <td className="px-2 py-2 truncate">
        {ev.skillName}
        <SkillNameSuffix ev={ev} />
      </td>
      <td className={numCell}>
        <PoolValue value={ev.cumulativeConcerto} color="var(--ui-concerto)" />
      </td>
      <td className={numCell}>
        <PoolValue value={ev.cumulativeEnergy} color="var(--ui-resonance)" />
      </td>
      <td className={numCell}>
        <span className="text-muted-foreground/40">—</span>
      </td>
      <StatPad />
    </tr>
  )
}
