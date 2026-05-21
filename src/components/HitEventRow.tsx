import { Fragment, useState } from "react"
import type { HitEvent, SimulationLogEntry } from "#/types/simulation-log"
import { getCharacterById } from "#/lib/catalog"
import { formatSkillType } from "#/data/skill-types"
import {
  computeFormulaBreakdown,
  formatActiveBuffLabel,
  formatCDCell,
  formatCRCell,
  formatDeepenCell,
  formatDMGPctCell,
  formatERCell,
  formatScalingCell,
  formatStatComponents,
} from "#/lib/damage/hit-formula"

type ActionOrHitEntry = Extract<SimulationLogEntry, { kind: "action" | "hit" }>

interface HitEventRowProps {
  index: number
  ev: ActionOrHitEntry
}

export function HitEventRow({ index, ev }: HitEventRowProps) {
  const [expanded, setExpanded] = useState(false)
  const character = getCharacterById(ev.characterId)
  const isAction = ev.kind === "action"

  return (
    <Fragment>
      <tr
        className={`border-b border-gray-800 ${isAction ? "" : "text-gray-500"} ${ev.kind === "hit" ? "cursor-pointer hover:bg-gray-800/40" : ""}`}
        onClick={
          ev.kind === "hit" ? () => setExpanded((prev) => !prev) : undefined
        }
      >
        <td className="py-1 pr-3 text-gray-500">
          {ev.kind === "hit"
            ? `${expanded ? "▾" : "▸"} ${index + 1}`
            : index + 1}
        </td>
        <td className="py-1 pr-3">{character?.name ?? "?"}</td>
        <td className="py-1 pr-3 text-gray-400">
          {isAction ? formatSkillType(ev.skillType) : ""}
        </td>
        <td className="py-1 pr-3">
          {ev.skillName}
          {ev.kind === "action" && ev.variantKind ? (
            <span className="ml-2 text-xs text-blue-400/80">
              {ev.variantKind === "cancel"
                ? "(Cancel)"
                : ev.variantKind === "instantCancel"
                  ? "(Instant Cancel)"
                  : "(Swap)"}
            </span>
          ) : null}
          {ev.kind === "action" &&
          ev.delayBreakdown &&
          (ev.delayBreakdown.react > 0 || ev.delayBreakdown.pad > 0) ? (
            <span
              className="ml-2 text-xs text-gray-500"
              title={[
                ev.delayBreakdown.react > 0
                  ? `react: ${(ev.delayBreakdown.react / 60).toFixed(2)}s`
                  : "",
                ev.delayBreakdown.pad > 0
                  ? `pad: ${(ev.delayBreakdown.pad / 60).toFixed(2)}s`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              +
              {((ev.delayBreakdown.react + ev.delayBreakdown.pad) / 60).toFixed(
                2,
              )}
              s
            </span>
          ) : null}
          {ev.kind === "hit" && ev.synthetic ? (
            <span className="ml-2 text-xs text-cyan-400/80 italic">
              (coord)
            </span>
          ) : null}
        </td>
        <td className="py-1 pr-3">{(ev.frame / 60).toFixed(2)}s</td>
        <td className="py-1 pr-3 text-right">
          {ev.cumulativeConcerto.toFixed(1)}
        </td>
        <td className="py-1 pr-3 text-right">
          {ev.cumulativeEnergy.toFixed(1)}
        </td>
        <td className="py-1 pr-3 text-right text-yellow-400">
          {ev.kind === "hit" ? ev.damage.toLocaleString() : ""}
        </td>
        <td className="py-1 pr-3 text-right text-xs">
          {ev.kind === "hit"
            ? formatScalingCell(ev.statsSnapshot, ev.scalingStat)
            : ""}
        </td>
        <td className="py-1 pr-3 text-right text-xs">
          {ev.kind === "hit"
            ? formatERCell(ev.statsSnapshot.energyRechargePct)
            : ""}
        </td>
        <td className="py-1 pr-3 text-right text-xs">
          {ev.kind === "hit" ? formatCRCell(ev.statsSnapshot.critRate) : ""}
        </td>
        <td className="py-1 pr-3 text-right text-xs">
          {ev.kind === "hit" ? formatCDCell(ev.statsSnapshot.critDmg) : ""}
        </td>
        <td className="py-1 pr-3 text-right text-xs">
          {ev.kind === "hit"
            ? formatDMGPctCell(ev.statsSnapshot, ev.element, ev.skillType)
            : ""}
        </td>
        <td className="py-1 text-right text-xs">
          {ev.kind === "hit"
            ? formatDeepenCell(ev.statsSnapshot, ev.element, ev.skillType)
            : ""}
        </td>
      </tr>
      {ev.kind === "hit" && expanded && (
        <tr className="border-b border-gray-800 bg-gray-950/60">
          <td colSpan={14} className="py-2 px-3">
            <HitDrawer ev={ev} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function HitDrawer({ ev }: { ev: HitEvent }) {
  const snap = ev.statsSnapshot
  const bd = computeFormulaBreakdown(ev)
  const cr = Math.min(snap.critRate, 1)
  const critFactor = 1 - cr + cr * snap.critDmg

  return (
    <div className="text-xs text-gray-300 space-y-1.5">
      <div className="flex flex-wrap gap-x-6 gap-y-0.5">
        <span>{formatStatComponents(snap, "ATK")}</span>
        <span>{formatStatComponents(snap, "HP")}</span>
        <span>{formatStatComponents(snap, "DEF")}</span>
      </div>
      <div className="text-gray-400">
        Crit Factor:{" "}
        <span className="text-gray-200">{critFactor.toFixed(4)}</span>
        <span className="text-gray-500 ml-1">
          (1 − {(cr * 100).toFixed(0)}% + {(cr * 100).toFixed(0)}% ×{" "}
          {(snap.critDmg * 100).toFixed(0)}%)
        </span>
      </div>
      {snap.defShred !== 0 && (
        <div className="text-gray-400">
          DEF Shred:{" "}
          <span className="text-gray-200">
            {(snap.defShred * 100).toFixed(1)}%
          </span>
        </div>
      )}
      <div className="font-mono text-gray-400">
        {Math.round(bd.scalingValue)} × {bd.multiplier.toFixed(2)} × (1 +{" "}
        {(bd.dmgBonus * 100).toFixed(1)}%) × (1 + {(bd.deepen * 100).toFixed(1)}
        %) × {bd.critFactor.toFixed(4)} × {bd.defMult.toFixed(4)} ×{" "}
        {bd.resMult.toFixed(4)} ={" "}
        <span className="text-yellow-400">{bd.result.toLocaleString()}</span>
      </div>
      <div className="text-gray-500">
        Passive buffs:{" "}
        {ev.passiveBuffs.length === 0
          ? "—"
          : ev.passiveBuffs
              .map((b) =>
                formatActiveBuffLabel(
                  b,
                  (id) => getCharacterById(id)?.name ?? `#${id}`,
                ),
              )
              .join(", ")}
      </div>
      <div className="text-gray-500">
        Active buffs:{" "}
        {ev.activeBuffs.length === 0
          ? "—"
          : ev.activeBuffs
              .map((b) =>
                formatActiveBuffLabel(
                  b,
                  (id) => getCharacterById(id)?.name ?? `#${id}`,
                ),
              )
              .join(", ")}
      </div>
    </div>
  )
}
