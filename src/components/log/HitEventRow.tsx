import { Fragment } from "react"
import type { HitEvent } from "#/types/simulation-log"
import {
  CharCell,
  CritCellValue,
  SkillNameSuffix,
  renderPoolValue,
  numCell,
  COL_COUNT,
} from "./log-cells"
import { HitEventDetail } from "./HitEventDetail"
import { formatFrames } from "#/lib/format"
import {
  formatDMGPctCell,
  formatDeepenCell,
  formatERCell,
  formatScalingCell,
} from "#/lib/damage/hit-formula"

export function HitEventRow({
  ev,
  index,
  isOpen,
  onToggle,
}: {
  ev: HitEvent
  index: number
  isOpen: boolean
  onToggle: () => void
}) {
  const snap = ev.statsSnapshot
  return (
    <Fragment>
      <tr
        className="border-t border-border/60 text-muted cursor-pointer hover:bg-gray-800/40"
        onClick={onToggle}
      >
        <td className="px-2 py-2 font-mono text-xs text-right text-muted-foreground">
          <span className="text-muted-foreground/70 mr-1">
            {isOpen ? "▾" : "▸"}
          </span>
          {index + 1}
        </td>
        <td className={`${numCell} text-[16px] text-[#a3bfff]`}>
          {formatFrames(ev.frame)}
        </td>
        <td className="px-2 py-2">
          <CharCell id={ev.characterId} />
        </td>
        <td className="px-2 py-2" />
        <td className="px-2 py-2 truncate">
          {ev.coord ? "Coord" : ev.skillName}
          <SkillNameSuffix ev={ev} />
        </td>
        <td className={numCell}>
          {renderPoolValue(ev.cumulativeConcerto, "#f5d061")}
        </td>
        <td className={numCell}>
          {renderPoolValue(ev.cumulativeEnergy, "#9b6cf0")}
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
          {formatDeepenCell(snap, ev.element, ev.skillType)}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t border-border/40 bg-darkest/60">
          <td colSpan={COL_COUNT} className="px-3 py-2">
            <HitEventDetail ev={ev} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}
