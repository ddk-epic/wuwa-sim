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
  buffs: [
    {
      id: "weapon.stellar-symphony.hp",
      name: "Astral Evolvement (HP)",
      description: "Permanent +12–24% HP.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "hpPct" },
          value: { kind: "const", v: [0.12, 0.15, 0.18, 0.21, 0.24] },
        },
      ],
    },
    {
      id: "weapon.stellar-symphony.concerto",
      name: "Astral Evolvement (Concerto)",
      description:
        "On Resonance Liberation cast, restores 8–16 Concerto Energy. Cooldown: 20s.",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillCategory: "Resonance Liberation",
      },
      cooldown: 20,
      effects: [
        {
          kind: "resource",
          resource: "concerto",
          op: "add",
          value: { kind: "const", v: [8, 10, 12, 14, 16] },
        },
      ],
    },
    {
      id: "weapon.stellar-symphony.heal-atk",
      name: "Astral Evolvement (ATK)",
      description:
        "On Resonance Skill heal, nearby party members gain 14–28% ATK for 30s.",
      trigger: {
        event: "healLanded",
        actor: "self",
        skillCategory: "Resonance Skill",
      },
      target: { kind: "global" },
      duration: { kind: "seconds", v: 30 },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: [0.14, 0.175, 0.21, 0.245, 0.28] },
        },
      ],
    },
  ],
} satisfies WeaponData
