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
  | "allAmp"
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
  elementAmp: Record<Element, number>
  skillTypeAmp: Record<SkillType, number>
  allAmp: number
  defShred: number
  shreds: Record<SkillType, number>
  energyRechargePct: number
  forteRechargePct: number
  healingBonus: number
  bonusMultiplier: number
  energyGainMult: number
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
    elementAmp: emptyElementMap(),
    skillTypeAmp: emptySkillTypeMap(),
    allAmp: 0,
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
