import type { EnrichedWeapon } from "#/types/weapon"

export const emeraldOfGenesis = {
  id: 21020015,
  name: "Emerald of Genesis",
  weaponType: "Sword",
  stats: {
    main: { name: "ATK", base: 47, max: 587.5 },
    sub: { name: "Crit. Rate", base: 0.054, max: 0.243 },
  },
  passive: { name: "Stormy Resolution" },
} satisfies EnrichedWeapon
