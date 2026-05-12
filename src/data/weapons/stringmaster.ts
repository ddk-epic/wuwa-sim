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
      id: "weapon.stringmaster.passive.elem-bonus",
      name: "Electric Amplification — Elemental DMG",
      description: "Permanent Elemental DMG Bonus from Stringmaster passive.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "all" },
          value: { kind: "const", v: [0.12, 0.15, 0.18, 0.21, 0.24] },
        },
      ],
    },
    {
      id: "weapon.stringmaster.passive.skill-atk",
      name: "Electric Amplification — Skill ATK",
      description:
        "On Resonance Skill cast, increases ATK by 12–24% per stack, up to 2 stacks for 5s.",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillType: "Resonance Skill",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 5 },
      stacking: { max: 2, onRetrigger: "addStack" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "perStack", v: [0.12, 0.15, 0.18, 0.21, 0.24] },
        },
      ],
    },
    {
      id: "weapon.stringmaster.passive.off-field-atk",
      name: "Electric Amplification — Off-field ATK",
      description: "While the wielder is off-field, increases their ATK.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      condition: { kind: "actorIsOffField" },
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: [0.12, 0.15, 0.18, 0.21, 0.24] },
        },
      ],
    },
  ],
} satisfies WeaponData
