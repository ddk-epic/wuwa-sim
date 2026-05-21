import type { ActionEvent } from "#/types/simulation-log"
import {
  CharCell,
  TypePill,
  SkillNameSuffix,
  renderPoolValue,
  numCell,
} from "./log-cells"
import { formatFrames } from "#/lib/format"

export function ActionEventRow({
  ev,
  index,
}: {
  ev: ActionEvent
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
        <TypePill characterId={ev.characterId} skillType={ev.skillType} />
      </td>
      <td className="px-2 py-2 truncate">
        {ev.skillName}
        <SkillNameSuffix ev={ev} />
      </td>
      <td className={numCell}>
        {renderPoolValue(ev.cumulativeConcerto, "#f5d061")}
      </td>
      <td className={numCell}>
        {renderPoolValue(ev.cumulativeEnergy, "#9b6cf0")}
      </td>
      <td className={numCell}>
        <span className="text-muted-foreground/40">—</span>
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
