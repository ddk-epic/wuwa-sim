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
      description:
        "Energy Regen not modeled in v1 — energy regen lands with resource state in a future slice.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [],
    },
    {
      id: "weapon.emerald-of-genesis.passive.atk",
      name: "Stormy Resolution (ATK)",
      description:
        "On Resonance Skill cast, ATK increases by 6–12% per stack, up to 2 stacks for 10s.",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillType: "Resonance Skill",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      stacking: { max: 2, onRetrigger: "addStack" },
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
