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
