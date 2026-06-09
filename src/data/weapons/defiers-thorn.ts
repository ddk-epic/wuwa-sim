import type { WeaponData } from "#/types/weapon"

export const defiersThorn = {
  id: 21020056,
  name: "Defier's Thorn",
  weaponType: "Sword",
  stats: {
    main: { name: "ATK", base: 33, max: 412.5 },
    sub: { name: "HP", base: 0.00001605, max: 0.7223 },
  },
  passive: { name: "A Free Knight's Tarantella" },
  buffs: [
    {
      id: "weapon.defiers-thorn.passive.hp",
      name: "A Free Knight's Tarantella (HP)",
      description: "Permanent Max HP +12%–24%.",
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
      id: "weapon.defiers-thorn.def-ignore",
      name: "A Free Knight's Tarantella (DEF Ignore)",
      description:
        "15s after casting Intro Skill or Basic Attack, ignore 8%–16% of the target's DEF.",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillCategory: ["Intro Skill", "Basic Attack"],
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 15 },
      stacking: { max: 1, onRetrigger: "refresh" },
      effects: [
        {
          kind: "stat",
          path: { stat: "defShred" },
          value: { kind: "const", v: [0.08, 0.1, 0.12, 0.14, 0.16] },
        },
      ],
    },
    {
      id: "weapon.defiers-thorn.amplify",
      name: "A Free Knight's Tarantella (Amplify)",
      description:
        "Within 15s of casting Intro Skill or Basic Attack, while the target has Aero Erosion, DMG taken by the target is Amplified by 20%–40%.",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillCategory: ["Intro Skill", "Basic Attack"],
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 15 },
      stacking: { max: 1, onRetrigger: "refresh" },
      condition: { kind: "targetHasNegStatus", status: "Aero Erosion" },
      effects: [
        {
          kind: "stat",
          path: { stat: "allAmp" },
          value: { kind: "const", v: [0.2, 0.25, 0.3, 0.35, 0.4] },
        },
      ],
    },
  ],
} satisfies WeaponData
