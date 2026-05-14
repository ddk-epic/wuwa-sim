// Column-2 substat values from references/echo-stats.md
export const ECHO_SUBSTAT = {
  critRate: 0.069,
  critDmg: 0.138,
  atkPct: 0.071,
  energyRechargePct: 0.076,
  skillDmgBonus: 0.071,
} as const

// 16-roll universal default: 5 CR, 5 CD, 2 ATK%, 2 ER, 2 Skill DMG
export const DEFAULT_SUBSTAT_ROLLS = {
  critRate: 5,
  critDmg: 5,
  atkPct: 2,
  energyRechargePct: 2,
  skillDmgBonus: 2,
} as const

// Fixed main stat values at Level 25 max (references/echo-stats.md)
export const ECHO_MAIN_FIXED = {
  cost4FlatAtk: 150,
  cost3FlatAtk: 100,
  cost1FlatHp: 2280,
} as const

// Cost-1 variable main stat values by scaling stat (references/echo-stats.md)
export const ECHO_MAIN_1COST_SCALING = {
  atk: 0.18,
  hp: 0.18,
  def: 0.228,
} as const

// Echo cost slot counts per build
export const ECHO_BUILD_LAYOUT = {
  "4-3-3-1-1": { cost4: 1, cost3: 2, cost1: 2 },
  "4-4-1-1-1": { cost4: 2, cost3: 0, cost1: 3 },
} as const
