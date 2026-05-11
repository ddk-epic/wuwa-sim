import type { WeaponData } from "#/types/weapon"

export const emeraldOfGenesis = {
  id: 21020015,
  name: "Emerald of Genesis",
  weaponType: "Sword",
  stats: {
    main: { name: "ATK", base: 47, max: 587.5 },
    sub: { name: "Crit. Rate", base: 0.054, max: 0.243 },
  },
  passive: { name: "Stormy Resolution" },
  buffs: [
    {
      id: "weapon.emerald-of-genesis.passive.energy-regen",
      name: "Stormy Resolution — Energy Regen",
      description:
        "Energy Regen not modeled in v1 — energy regen lands with resource state in a future slice.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [],
    },
  ],
} satisfies WeaponData
