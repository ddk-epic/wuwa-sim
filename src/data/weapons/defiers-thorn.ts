import type { WeaponData } from "#/types/weapon"

export const defiersThorn = {
  id: 21020056,
  name: "Defier's Thorn",
  weaponType: "Sword",
  stats: {
    main: { name: "ATK", base: 33, max: 412.5 },
    sub: { name: "HP", base: 0.000016050000488758086, max: 0.7223 },
  },
  passive: { name: "A Free Knight's Tarantella" },
  buffs: [],
} satisfies WeaponData
