import type { WeaponData } from "#/types/weapon"

export const redSpring = {
  id: 21020026,
  name: "Red Spring",
  weaponType: "Sword",
  stats: {
    main: { name: "ATK", base: 47, max: 587.5 },
    sub: { name: "Crit. Rate", base: 0.054, max: 0.243 },
  },
  passive: { name: "Beyond the Cycle" },
  buffs: [
    {
      id: "weapon.red-spring.passive.atk",
      name: "Beyond the Cycle (ATK)",
      description: "Permanent +12–24% ATK.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: [0.12, 0.15, 0.18, 0.21, 0.24] },
        },
      ],
    },
    {
      id: "weapon.red-spring.basic-stack",
      name: "Beyond the Cycle (Basic)",
      description:
        "On dealing Basic Attack DMG, gain 10–20% Basic Attack DMG Bonus for 14s. Once per second, stacks up to 3.",
      trigger: {
        event: "hitLanded",
        actor: "self",
        skillCategory: "Basic Attack",
        source: "self",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 14 },
      stacking: { max: 3, onRetrigger: "addStackRefresh" },
      cooldown: 1,
      effects: [
        {
          kind: "stat",
          path: { stat: "skillTypeBonus", key: "Basic Attack" },
          value: { kind: "perStack", v: [0.1, 0.125, 0.15, 0.175, 0.2] },
        },
      ],
    },
    {
      id: "weapon.red-spring.concerto-basic",
      name: "Beyond the Cycle (Concerto)",
      description:
        "When Concerto Energy is consumed, gain 40–80% Basic Attack DMG Bonus for 10s. Once per second, ends when switched off-field.",
      trigger: {
        event: "resourceConsumed",
        resource: "concerto",
        actor: "self",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      cooldown: 1,
      expiresOnSourceSwapOut: true,
      effects: [
        {
          kind: "stat",
          path: { stat: "skillTypeBonus", key: "Basic Attack" },
          value: { kind: "const", v: [0.4, 0.5, 0.6, 0.7, 0.8] },
        },
      ],
    },
  ],
} satisfies WeaponData
