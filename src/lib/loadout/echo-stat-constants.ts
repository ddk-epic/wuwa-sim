import type { Character } from "#/types/character"
import type { Cost3Main, Cost4Main, EchoBuild } from "#/types/loadout"

// Column-2 substat values from references/echo-stats.md
export const ECHO_SUBSTAT = {
  critRate: 0.075,
  critDmg: 0.15,
  atkPct: 0.086,
  hpPct: 0.086,
  defPct: 0.109,
  energyRechargePct: 0.092,
  skillDmgBonus: 0.086,
} as const

// 16-roll universal default: 5 CR, 5 CD, 2 scaling-main, 2 ER, 2 Skill DMG
export const DEFAULT_SUBSTAT_ROLLS = {
  critRate: 5,
  critDmg: 5,
  scalingMain: 2,
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

// Cost-4 variable main stat values (references/echo-stats.md)
export const ECHO_MAIN_4COST_VARIABLE = {
  scaling: { atk: 0.33, hp: 0.33, def: 0.415 },
  cr: 0.22,
  cd: 0.44,
} as const

// Cost-3 variable main stat values (references/echo-stats.md)
export const ECHO_MAIN_3COST_VARIABLE = {
  scaling: { atk: 0.3, hp: 0.3, def: 0.38 },
  er: 0.32,
  elemDmg: 0.3,
} as const

const BASE_STAT_NODES = ["ATK", "HP", "DEF"] as const

// Echo build funnels rolls into the base stat the character's skill tree grants.
export function scalingStatFromSkillTree(
  character: Pick<Character, "skillTreeBonuses">,
): "atk" | "hp" | "def" {
  const node = character.skillTreeBonuses.find((n) =>
    BASE_STAT_NODES.includes(n as (typeof BASE_STAT_NODES)[number]),
  )
  return node ? (node.toLowerCase() as "atk" | "hp" | "def") : "atk"
}

export const DEFAULT_ECHO_BUILD: EchoBuild = "4-3-3-1-1"

export interface EchoBuildLayout {
  cost4: number
  cost3: number
  cost1: number
  cost4Default: Cost4Main[]
  cost3Default: Cost3Main[]
}

// Single source of truth for Echo Build Presets: slot counts + default mains.
export const ECHO_BUILDS: Record<EchoBuild, EchoBuildLayout> = {
  "4-3-3-1-1": {
    cost4: 1,
    cost3: 2,
    cost1: 2,
    cost4Default: ["cd"],
    cost3Default: ["elemDmg", "elemDmg"],
  },
  "4-4-1-1-1": {
    cost4: 2,
    cost3: 0,
    cost1: 3,
    cost4Default: ["cr", "cd"],
    cost3Default: [],
  },
}

export const ECHO_BUILD_LIST = Object.keys(ECHO_BUILDS) as EchoBuild[]
