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
import { getCharacterById } from "#/lib/loadout/catalog"

export function ActionEventRow({
  ev,
  index,
  showWait = false,
}: {
  ev: ActionEvent
  index: number
  showWait?: boolean
}) {
  const maxEnergy = getCharacterById(ev.characterId)?.maxEnergy ?? 100
  return (
    <tr className="border-t border-border/60">
      <IndexCell index={index} />
      <FrameCell frame={ev.frame} />
      {showWait && <WaitCell wait={ev.delayBreakdown?.wait} />}
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
        <PoolValue
          value={ev.cumulativeConcerto}
          resource="concerto"
          threshold={100}
        />
      </td>
      <td className={numCell}>
        <PoolValue
          value={ev.cumulativeEnergy}
          resource="energy"
          threshold={maxEnergy}
        />
      </td>
      <td className={numCell}>
        <span className="text-muted-foreground/40">—</span>
      </td>
      <StatPad />
    </tr>
  )
}
