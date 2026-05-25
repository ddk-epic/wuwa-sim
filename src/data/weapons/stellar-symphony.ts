import type { WeaponData } from "#/types/weapon"

export const stellarSymphony = {
  id: 21050036,
  name: "Stellar Symphony",
  weaponType: "Rectifier",
  stats: {
    main: { name: "ATK", base: 33, max: 412.5 },
    sub: { name: "Energy Regen", base: 0.1712, max: 0.7704 },
  },
  passive: { name: "Astral Evolvement" },
  buffs: [],
} satisfies WeaponData
