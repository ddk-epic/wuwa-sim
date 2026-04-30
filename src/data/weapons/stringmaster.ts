import type { EnrichedWeapon } from "#/types/weapon"

export const stringmaster = {
  id: 21050016,
  name: "Stringmaster",
  weaponType: "Rectifier",
  stats: {
    main: { base: 40, max: 500 },
    sub: { base: 0.08, max: 0.36 },
  },
  passive: { name: "Electric Amplification" },
} satisfies EnrichedWeapon
