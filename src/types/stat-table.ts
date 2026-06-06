import type { Element } from "#/data/elements"
import { ELEMENTS } from "#/data/elements"
import type { SkillType } from "./character"

const SKILL_TYPES: SkillType[] = [
  "Basic Attack",
  "Heavy Attack",
  "Resonance Skill",
  "Resonance Liberation",
  "Intro Skill",
  "Outro Skill",
  "Echo Skill",
]

function emptySkillTypeMap(): Record<SkillType, number> {
  return Object.fromEntries(SKILL_TYPES.map((t) => [t, 0])) as Record<
    SkillType,
    number
  >
}

function emptyElementMap(): Record<Element, number> {
  return Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<
    Element,
    number
  >
}

export type ScalarStatKey =
  | "atkPct"
  | "atkFlat"
  | "hpPct"
  | "hpFlat"
  | "defPct"
  | "defFlat"
  | "critRate"
  | "critDmg"
  | "defShred"
  | "allDmgBonus"
  | "allDeepen"
  | "energyRechargePct"
  | "forteRechargePct"
  | "healingBonus"
  | "bonusMultiplier"
  | "energyGainMult"
  | "vul"

export interface StatTable {
  atkBase: number
  atkPct: number
  atkFlat: number
  hpBase: number
  hpPct: number
  hpFlat: number
  defBase: number
  defPct: number
  defFlat: number
  critRate: number
  critDmg: number
  elementBonus: Record<Element, number>
  skillTypeBonus: Record<SkillType, number>
  allDmgBonus: number
  elementDeepen: Record<Element, number>
  skillTypeDeepen: Record<SkillType, number>
  allDeepen: number
  defShred: number
  shreds: Record<SkillType, number>
  energyRechargePct: number
  forteRechargePct: number
  healingBonus: number
  bonusMultiplier: number
  /**
   * Energy Regen Multiplier. Folded into energy accrual as a
   * `× (1 + energyGainMult)` factor on consuming attacks only.
   */
  energyGainMult: number
  /**
   * Vulnerability ("takes more DMG"). Its own multiplicative bucket in the
   * damage formula — additive within itself, independent of dmgBonus and
   * deepen. Modelled attacker-side (single-target sim); see ADR-0035.
   */
  vul: number
}

export function emptyStatTable(): StatTable {
  return {
    atkBase: 0,
    atkPct: 0,
    atkFlat: 0,
    hpBase: 0,
    hpPct: 0,
    hpFlat: 0,
    defBase: 0,
    defPct: 0,
    defFlat: 0,
    critRate: 0,
    critDmg: 0,
    elementBonus: emptyElementMap(),
    skillTypeBonus: emptySkillTypeMap(),
    allDmgBonus: 0,
    elementDeepen: emptyElementMap(),
    skillTypeDeepen: emptySkillTypeMap(),
    allDeepen: 0,
    defShred: 0,
    shreds: emptySkillTypeMap(),
    energyRechargePct: 0,
    forteRechargePct: 0,
    healingBonus: 0,
    bonusMultiplier: 0,
    energyGainMult: 0,
    vul: 0,
  }
}
