import type { SkillType } from "./character"

const SKILL_TYPES: SkillType[] = [
  "Basic Attack",
  "Heavy Attack",
  "Resonance Skill",
  "Resonance Liberation",
  "Forte Circuit",
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
  elementBonus: Record<string, number>
  skillTypeBonus: Record<SkillType, number>
  deepens: Record<string, number>
  defShred: number
  shreds: Record<SkillType, number>
  allDmgBonus: number
  energyRechargePct: number
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
    elementBonus: {},
    skillTypeBonus: emptySkillTypeMap(),
    deepens: emptySkillTypeMap(),
    defShred: 0,
    shreds: emptySkillTypeMap(),
    allDmgBonus: 0,
    energyRechargePct: 0,
  }
}
