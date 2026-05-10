import type { WeaponData } from "#/types/weapon"

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
      description: "Permanent ATK% boost from Stringmaster passive.",
      trigger: { event: "simStart" as const },
      target: { kind: "self" as const },
      duration: { kind: "permanent" as const },
      effects: [
        {
          kind: "stat" as const,
          path: { stat: "atkPct" as const },
          value: {
            kind: "byRank" as const,
            values: [0.12, 0.15, 0.18, 0.21, 0.24],
          },
        },
      ],
    },
  ],
} satisfies WeaponData
