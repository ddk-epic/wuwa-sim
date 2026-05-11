import { Fragment, useState } from "react"
import type {
  ActiveBuff,
  HitEvent,
  SimulationLogEntry,
} from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import { getCharacterById } from "#/lib/catalog"
import { formatSkillType } from "#/data/skill-types"
import { DEF_MULT_CONST, RES_MULT_CONST } from "#/lib/compute-damage"

function resolvedScalingValue(snap: StatTable, rawStat?: string): number {
  const stat = (rawStat ?? "ATK").toUpperCase()
  if (stat === "HP") return snap.hpBase * (1 + snap.hpPct) + snap.hpFlat
  if (stat === "DEF") return snap.defBase * (1 + snap.defPct) + snap.defFlat
  return snap.atkBase * (1 + snap.atkPct) + snap.atkFlat
}

export function formatScalingCell(
  snap: StatTable,
  scalingStat?: string,
): string {
  const stat = (scalingStat ?? "ATK").toUpperCase()
  const label = stat === "HP" || stat === "DEF" ? stat : "ATK"
  return `${label} ${Math.round(resolvedScalingValue(snap, scalingStat))}`
}

export function formatERCell(pct: number): string {
  return `${Math.round((1 + pct) * 100)}%`
}

export function formatCRCell(rate: number): string {
  const pct = `${Math.round(rate * 100)}%`
  return rate > 1 ? `${pct} (capped 100%)` : pct
}

export function formatCDCell(dmg: number): string {
  return `${Math.round(dmg * 100)}%`
}

export function formatDMGPctCell(
  snap: StatTable,
  element: string,
  skillType: string,
): string {
  const total =
    (snap.elementBonus[element] ?? 0) +
    (snap.skillTypeBonus[skillType] ?? 0) +
    snap.allDmgBonus
  return `+${Math.round(total * 100)}%`
}

export function formatDeepenCell(snap: StatTable, dmgType: string): string {
  const v = snap.deepen[dmgType] ?? 0
  return `+${Math.round(v * 100)}%`
}

type StatKind = "ATK" | "HP" | "DEF"

function normalizeStatKind(raw?: string): StatKind {
  const u = (raw ?? "ATK").toUpperCase()
  if (u === "HP") return "HP"
  if (u === "DEF") return "DEF"
  return "ATK"
}

function statComponents(
  snap: StatTable,
  kind: StatKind,
): { base: number; pct: number; flat: number } {
  if (kind === "HP")
    return { base: snap.hpBase, pct: snap.hpPct, flat: snap.hpFlat }
  if (kind === "DEF")
    return { base: snap.defBase, pct: snap.defPct, flat: snap.defFlat }
  return { base: snap.atkBase, pct: snap.atkPct, flat: snap.atkFlat }
}

export function formatStatComponents(
  snap: StatTable,
  rawStat?: string,
): string {
  const kind = normalizeStatKind(rawStat)
  const { base, pct, flat } = statComponents(snap, kind)
  const resolved = Math.round(base * (1 + pct) + flat)
  return `${kind} ${resolved} (${base} × ${(1 + pct).toFixed(2)} + ${flat})`
}

export interface FormulaBreakdown {
  scalingValue: number
  multiplier: number
  dmgBonus: number
  deepen: number
  critFactor: number
  defMult: number
  resMult: number
  result: number
}

export function computeFormulaBreakdown(
  ev: Pick<
    HitEvent,
    | "element"
    | "dmgType"
    | "skillType"
    | "scalingStat"
    | "multiplier"
    | "statsSnapshot"
  >,
): FormulaBreakdown {
  const snap = ev.statsSnapshot
  const kind = normalizeStatKind(ev.scalingStat)
  const { base, pct, flat } = statComponents(snap, kind)
  const scalingValue = base * (1 + pct) + flat

  const dmgBonus =
    (snap.elementBonus[ev.element] ?? 0) +
    (snap.skillTypeBonus[ev.skillType] ?? 0) +
    snap.allDmgBonus

  const deepen = snap.deepen[ev.dmgType] ?? 0
  const cr = Math.min(snap.critRate, 1)
  const critFactor = 1 - cr + cr * snap.critDmg

  const defMult =
    DEF_MULT_CONST /
    (DEF_MULT_CONST + (1 - DEF_MULT_CONST) * (1 - snap.defShred))
  const baseResist = 1 - RES_MULT_CONST
  const elementResShred = snap.resShred[ev.element] ?? 0
  const effectiveResist = baseResist - elementResShred
  const resMult =
    effectiveResist >= 0 ? 1 - effectiveResist : 1 - effectiveResist / 2

  const result = Math.round(
    scalingValue *
      ev.multiplier *
      (1 + dmgBonus) *
      (1 + deepen) *
      critFactor *
      defMult *
      resMult,
  )

  return {
    scalingValue,
    multiplier: ev.multiplier,
    dmgBonus,
    deepen,
    critFactor,
    defMult,
    resMult,
    result,
  }
}

export function formatActiveBuffLabel(
  b: ActiveBuff,
  allBuffs: ActiveBuff[],
  resolveCharacterName: (id: number) => string,
): string {
  const nameCollision = allBuffs.filter((x) => x.name === b.name).length > 1
  const src =
    nameCollision && b.sourceCharacterId !== undefined
      ? ` (from ${resolveCharacterName(b.sourceCharacterId)})`
      : ""
  const stacks = b.stacks > 1 ? ` ×${b.stacks}` : ""
  return `${b.name}${stacks}${src}`
}

interface SimulationLogModalProps {
  log: SimulationLogEntry[]
  onClose: () => void
}

const BUFF_KINDS = new Set([
  "buffApplied",
  "buffRefreshed",
  "buffExpired",
  "buffConsumed",
])

export function SimulationLogModal({ log, onClose }: SimulationLogModalProps) {
  const hitCount = log.filter((e) => e.kind === "hit").length
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [showBuffs, setShowBuffs] = useState(true)
  const filteredLog = showBuffs
    ? log
    : log.filter((e) => !BUFF_KINDS.has(e.kind))

  const toggleRow = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-7xl max-h-[95vh] bg-gray-900 rounded-lg border border-gray-700 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-xl font-bold">Simulation Log</h2>
            <p className="text-gray-400 text-sm mt-0.5">{hitCount} hits</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 select-none">
              <input
                type="checkbox"
                checked={showBuffs}
                onChange={(e) => setShowBuffs(e.target.checked)}
              />
              Show buff events
            </label>
            <button
              className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {log.length === 0 ? (
            <p className="py-8 text-center text-gray-500 text-sm">
              No simulation data. Click Simulate to generate.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-gray-400">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Character</th>
                  <th className="py-2 pr-3">Skill Type</th>
                  <th className="py-2 pr-3">Skill</th>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3 text-right">Concerto</th>
                  <th className="py-2 pr-3 text-right">Energy</th>
                  <th className="py-2 pr-3 text-right">Damage</th>
                  <th className="py-2 pr-3 text-right text-xs">Scaling</th>
                  <th className="py-2 pr-3 text-right text-xs">ER</th>
                  <th className="py-2 pr-3 text-right text-xs">CR</th>
                  <th className="py-2 pr-3 text-right text-xs">CD</th>
                  <th className="py-2 pr-3 text-right text-xs">DMG%</th>
                  <th className="py-2 text-right text-xs">Deepen</th>
                </tr>
              </thead>
              <tbody>
                {filteredLog.map((entry, i) => {
                  const isBuff = BUFF_KINDS.has(entry.kind)
                  if (isBuff) {
                    const buff = entry as Extract<
                      SimulationLogEntry,
                      {
                        kind:
                          | "buffApplied"
                          | "buffRefreshed"
                          | "buffExpired"
                          | "buffConsumed"
                      }
                    >
                    const target = getCharacterById(buff.targetCharacterId)
                    const verb =
                      buff.kind === "buffApplied"
                        ? "applied"
                        : buff.kind === "buffRefreshed"
                          ? "refreshed"
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
                      <tr
                        key={i}
                        className="border-b border-gray-800 bg-gray-950/40"
                      >
                        <td className="py-1 pr-3 text-gray-500">{i + 1}</td>
                        <td className="py-1 pr-3">{target?.name ?? "?"}</td>
                        <td className={`py-1 pr-3 italic ${color}`}>
                          buff {verb}
                        </td>
                        <td className="py-1 pr-3">
                          {buff.buffName}
                          {buff.stacks > 1 ? ` × ${buff.stacks}` : ""}
                        </td>
                        <td className="py-1 pr-3">
                          {(buff.frame / 60).toFixed(2)}s
                        </td>
                        <td className="py-1 pr-3 text-right" />
                        <td className="py-1 pr-3 text-right" />
                        <td className="py-1 pr-3 text-right" />
                        <td className="py-1 pr-3 text-right" />
                        <td className="py-1 pr-3 text-right" />
                        <td className="py-1 pr-3 text-right" />
                        <td className="py-1 pr-3 text-right" />
                        <td className="py-1 pr-3 text-right" />
                        <td className="py-1 text-right" />
                      </tr>
                    )
                  }
                  const ev = entry as Extract<
                    SimulationLogEntry,
                    { kind: "action" | "hit" }
                  >
                  const character = getCharacterById(ev.characterId)
                  const isAction = ev.kind === "action"
                  const isExpanded = expanded.has(i)
                  return (
                    <Fragment key={i}>
                      <tr
                        className={`border-b border-gray-800 ${isAction ? "" : "text-gray-500"} ${ev.kind === "hit" ? "cursor-pointer hover:bg-gray-800/40" : ""}`}
                        onClick={
                          ev.kind === "hit" ? () => toggleRow(i) : undefined
                        }
                      >
                        <td className="py-1 pr-3 text-gray-500">
                          {ev.kind === "hit"
                            ? `${isExpanded ? "▾" : "▸"} ${i + 1}`
                            : i + 1}
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
                                : "(Instant Cancel)"}
                            </span>
                          ) : null}
                          {ev.kind === "hit" && ev.synthetic ? (
                            <span className="ml-2 text-xs text-cyan-400/80 italic">
                              (coord)
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1 pr-3">
                          {(ev.frame / 60).toFixed(2)}s
                        </td>
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
                            ? formatScalingCell(
                                ev.statsSnapshot,
                                ev.scalingStat,
                              )
                            : ""}
                        </td>
                        <td className="py-1 pr-3 text-right text-xs">
                          {ev.kind === "hit"
                            ? formatERCell(ev.statsSnapshot.energyRechargePct)
                            : ""}
                        </td>
                        <td className="py-1 pr-3 text-right text-xs">
                          {ev.kind === "hit"
                            ? formatCRCell(ev.statsSnapshot.critRate)
                            : ""}
                        </td>
                        <td className="py-1 pr-3 text-right text-xs">
                          {ev.kind === "hit"
                            ? formatCDCell(ev.statsSnapshot.critDmg)
                            : ""}
                        </td>
                        <td className="py-1 pr-3 text-right text-xs">
                          {ev.kind === "hit"
                            ? formatDMGPctCell(
                                ev.statsSnapshot,
                                ev.element,
                                ev.skillType,
                              )
                            : ""}
                        </td>
                        <td className="py-1 text-right text-xs">
                          {ev.kind === "hit"
                            ? formatDeepenCell(ev.statsSnapshot, ev.dmgType)
                            : ""}
                        </td>
                      </tr>
                      {ev.kind === "hit" && isExpanded && (
                        <tr className="border-b border-gray-800 bg-gray-950/60">
                          <td colSpan={14} className="py-2 px-3">
                            <HitDrawer ev={ev} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
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
        Active buffs:{" "}
        {ev.activeBuffs.length === 0
          ? "—"
          : ev.activeBuffs
              .map((b) =>
                formatActiveBuffLabel(
                  b,
                  ev.activeBuffs,
                  (id) => getCharacterById(id)?.name ?? `#${id}`,
                ),
              )
              .join(", ")}
      </div>
    </div>
  )
}
