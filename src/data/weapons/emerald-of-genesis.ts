import type { EnrichedWeapon } from "#/types/weapon"

const ENERGY_REGEN_BY_RANK = [0.128, 0.16, 0.192, 0.224, 0.256]

export const emeraldOfGenesis = {
  id: 21020015,
  name: "Emerald of Genesis",
  weaponType: "Sword",
  stats: {
    main: { name: "ATK", base: 47, max: 587.5 },
    sub: { name: "Crit. Rate", base: 0.054, max: 0.243 },
  },
  passive: { name: "Stormy Resolution" },
  buffsForRank: (_rank: number) => [
    {
      id: "weapon.emerald-of-genesis.passive.energy-regen",
      name: "Stormy Resolution — Energy Regen",
      description: `Permanent +${Math.round(ENERGY_REGEN_BY_RANK[_rank - 1] * 1000) / 10}% Energy Regen. Not modeled in v1 (energy regen lands with resource state in slice 6).`,
      trigger: { event: "simStart" as const },
      target: { kind: "self" as const },
      duration: { kind: "permanent" as const },
      effects: [],
    },
  ],
} satisfies EnrichedWeapon
