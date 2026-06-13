import { Fragment } from "react"
import type { HitEvent } from "#/types/simulation-log"
import {
  CharCell,
  CoordPill,
  CritCellValue,
  SkillNameSuffix,
  numCell,
  COL_COUNT,
  IndexCell,
  FrameCell,
  WaitCell,
} from "./log-cells"
import { PoolValue } from "../ui/PoolValue"
import { getCharacterById } from "#/lib/loadout/catalog"
import { HitEventDetail } from "./HitEventDetail"
import {
  formatDMGPctCell,
  formatAmpCell,
  formatERCell,
  formatScalingCell,
} from "#/lib/damage/hit-formula"

export function HitEventRow({
  ev,
  index,
  isOpen,
  onToggle,
  showWait = false,
}: {
  ev: HitEvent
  index: number
  isOpen: boolean
  onToggle: () => void
  showWait?: boolean
}) {
  const snap = ev.statsSnapshot
  const maxEnergy = getCharacterById(ev.characterId)?.maxEnergy ?? 100
  return (
    <Fragment>
      <tr
        className="border-t border-border/60 text-muted cursor-pointer hover:bg-gray-800/40"
        onClick={onToggle}
      >
        <IndexCell index={index} caret={isOpen} />
        <FrameCell frame={ev.frame} />
        {showWait && <WaitCell />}
        <td className="px-2 py-2">
          <CharCell id={ev.characterId} />
        </td>
        <td className="px-2 py-2">
          {ev.coord && <CoordPill element={ev.element} />}
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
          <span className="font-semibold text-sm text-yellow-400">
            {ev.damage.toLocaleString()}
          </span>
        </td>
        <td className={`${numCell} text-xs`}>
          {formatScalingCell(snap, ev.scalingStat)}
        </td>
        <td className={`${numCell} text-xs`}>
          {formatERCell(snap.energyRechargePct)}
        </td>
        <td className={`${numCell} text-xs`}>
          <CritCellValue value={snap.critRate} warnOverCap />
        </td>
        <td className={`${numCell} text-xs`}>
          <CritCellValue value={snap.critDmg} />
        </td>
        <td className={`${numCell} text-xs`}>
          {formatDMGPctCell(snap, ev.element, ev.skillType)}
        </td>
        <td className={`${numCell} text-xs`}>
          {formatAmpCell(snap, ev.element, ev.skillType)}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t border-border/40 bg-darkest/60">
          <td colSpan={COL_COUNT + (showWait ? 1 : 0)} className="px-3 py-2">
            <HitEventDetail ev={ev} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}
