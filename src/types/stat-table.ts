export interface StatTable {
  atkBase: number
  atkPct: number
  atkFlat: number
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
    critRate: 0,
    critDmg: 0,
    elementBonus: {},
    skillTypeBonus: {},
    deepen: {},
    defShred: 0,
    resShred: {},
  }
}
