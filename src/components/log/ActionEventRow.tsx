import type { ActionEvent } from "#/types/simulation-log"
import {
  CharCell,
  TypePill,
  SkillNameSuffix,
  renderPoolValue,
  numCell,
  IndexCell,
  FrameCell,
  StatPad,
} from "./log-cells"

export function ActionEventRow({
  ev,
  index,
}: {
  ev: ActionEvent
  index: number
}) {
  return (
    <tr className="border-t border-border/60">
      <IndexCell index={index} />
      <FrameCell frame={ev.frame} />
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
        {renderPoolValue(ev.cumulativeConcerto, "var(--ui-concerto)")}
      </td>
      <td className={numCell}>
        {renderPoolValue(ev.cumulativeEnergy, "var(--ui-resonance)")}
      </td>
      <td className={numCell}>
        <span className="text-muted-foreground/40">—</span>
      </td>
      <StatPad />
    </tr>
  )
}
