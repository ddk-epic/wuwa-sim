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
  skillTypeBonus: Record<string, number>
  deepen: Record<string, number>
  defShred: number
  resShred: Record<string, number>
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
    skillTypeBonus: {},
    deepen: {},
    defShred: 0,
    resShred: {},
  }
}
