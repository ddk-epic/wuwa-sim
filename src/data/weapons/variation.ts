import type { WeaponData } from "#/types/weapon"

export const variation = {
  id: 21050024,
  name: "Variation",
  weaponType: "Rectifier",
  stats: {
    main: { name: "ATK", base: 27, max: 337.5 },
    sub: { name: "Energy Regen", base: 0.1152, max: 0.5184 },
  },
  passive: { name: "Ceaseless Aria" },
  buffs: [
    {
      id: "weapon.variation.passive.ceaseless-aria",
      name: "Ceaseless Aria",
      description:
        "On Resonance Skill cast, restores 8–16 Concerto Energy. Cooldown: 20s. (In-game shield + DMG reduction + 3-hits expiry not modeled.)",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillType: "Resonance Skill",
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
  ],
} satisfies WeaponData
