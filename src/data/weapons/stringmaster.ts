import type { EnrichedWeapon } from "#/types/weapon"

export const stringmaster = {
  id: 21050016,
  name: "Stringmaster",
  weaponType: "Rectifier",
  stats: {
    main: { name: "ATK", base: 40, max: 500 },
    sub: { name: "Crit. Rate", base: 0.08, max: 0.36 },
  },
  passive: { name: "Electric Amplification" },
  buffs: [
    {
      id: "weapon.stringmaster.passive.atk",
      name: "Electric Amplification — ATK",
      description: "Permanent +12% ATK from Stringmaster passive.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.12 },
        },
      ],
    },
  ],
} satisfies EnrichedWeapon
