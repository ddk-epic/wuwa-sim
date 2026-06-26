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
      name: "Stormy Resolution (ER)",
      description: "Permanent +12.8–25.6% Energy Regen.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "energyRechargePct" },
          value: { kind: "const", v: [0.128, 0.16, 0.192, 0.224, 0.256] },
        },
      ],
    },
    {
      id: "weapon.emerald-of-genesis.atk",
      name: "Stormy Resolution (ATK)",
      description:
        "On Resonance Skill cast, ATK increases by 6–12% per stack, up to 2 stacks for 10s.",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillCategory: "Resonance Skill",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      stacking: { max: 2, onRetrigger: "addStackRefresh" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: [0.06, 0.075, 0.09, 0.105, 0.12] },
        },
      ],
    },
  ],
} satisfies WeaponData
