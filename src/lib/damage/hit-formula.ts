import type { Element } from "#/data/elements"
import type { SkillType } from "#/types/character"
import type { ActiveBuff, HitEvent } from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import { DEF_MULT_CONST, RES_MULT_CONST } from "#/lib/damage/compute-damage"

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
  element: Element,
  skillType: SkillType,
): string {
  const total =
    snap.elementBonus[element] +
    snap.skillTypeBonus[skillType] +
    snap.allDmgBonus
  return `+${Math.round(total * 100)}%`
}

export function formatDeepenCell(
  snap: StatTable,
  element: Element,
  skillType: SkillType,
): string {
  const total =
    snap.elementDeepen[element] +
    snap.skillTypeDeepen[skillType] +
    snap.allDeepen
  return `+${Math.round(total * 100)}%`
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
    snap.elementBonus[ev.element] +
    snap.skillTypeBonus[ev.skillType] +
    snap.allDmgBonus

  const deepen =
    snap.elementDeepen[ev.element] +
    snap.skillTypeDeepen[ev.skillType] +
    snap.allDeepen
  const cr = Math.min(snap.critRate, 1)
  const critFactor = 1 - cr + cr * snap.critDmg

  const defMult =
    DEF_MULT_CONST /
    (DEF_MULT_CONST + (1 - DEF_MULT_CONST) * (1 - snap.defShred))
  const baseResist = 1 - RES_MULT_CONST
  const skillResShred = snap.shreds[ev.skillType]
  const effectiveResist = baseResist - skillResShred
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
  resolveCharacterName: (id: number) => string,
): string {
  let tag: string
  if (b.id.startsWith("char.") && b.sourceCharacterId !== undefined) {
    tag = `[${resolveCharacterName(b.sourceCharacterId)}]`
  } else if (b.id.startsWith("echo-set.")) {
    tag = "[Set]"
  } else if (b.id.startsWith("echo.")) {
    tag = "[Echo]"
  } else if (b.id.startsWith("weapon.")) {
    tag = "[Weapon]"
  } else if (b.id.startsWith("skill-tree.")) {
    tag = "[Tree]"
  } else {
    tag = ""
  }
  const stacks = b.stacks > 1 ? ` ×${b.stacks}` : ""
  return tag ? `${tag} ${b.name}${stacks}` : `${b.name}${stacks}`
}
