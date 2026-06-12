import type { EnrichedEcho } from "#/types/echo"

export const nightmareCrownless = {
  id: 6000090,
  name: "Nightmare: Crownless",
  cost: 4,
  element: "Havoc",
  sets: ["Havoc Eclipse"],
  buffs: [
    {
      id: "echo.nightmare-crownless.havoc-basic-bonus",
      name: "Nightmare: Crownless (Havoc & Basic)",
      description:
        "While equipped in the main Echo slot, the Resonator gains +12% Havoc DMG and +12% Basic Attack DMG.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Havoc" },
          value: { kind: "const", v: 0.12 },
        },
        {
          kind: "stat",
          path: { stat: "skillTypeBonus", key: "Basic Attack" },
          value: { kind: "const", v: 0.12 },
        },
      ],
    },
    {
      id: "echo.nightmare-crownless.self-amp",
      name: "Nightmare: Crownless (Skill DMG)",
      description:
        "When Nightmare: Crownless hits a target, its Echo Skill DMG is increased by 20% for 2s. Does not stack.",
      trigger: {
        event: "hitLanded",
        actor: "self",
        source: "self",
        skillCategory: "Echo Skill",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 2 },
      stacking: { max: 1, onRetrigger: "refresh" },
      effects: [
        {
          kind: "stat",
          path: { stat: "skillTypeBonus", key: "Echo Skill" },
          value: { kind: "const", v: 0.2 },
        },
      ],
    },
  ],
  skill: {
    cooldown: 12,
    description:
      "Transform into Nightmare: Crownless and attack enemies in front, dealing 264.60% Havoc DMG. The Resonator with this Echo equipped in their main slot gains 12.00% Havoc DMG Bonus and 12.00% Basic Attack DMG Bonus.This skill has 3 initial charges, replenished once every 12s, max 3 charges. When Nightmare: Crownless hits a target, DMG dealt by this skill is increased by 20.00%. This effect lasts for 2s and does not stack.CD: 12s.",
    stages: [
      {
        name: "Tap",
        newName: "",
        actionTime: 72,
        footing: { launch: 30 },
        damage: [
          {
            type: "Echo Skill",
            dmgType: "Damage",
            scalingStat: "ATK",
            actionFrame: 60,
            value: 2.646,
            energy: 3.67,
            concerto: 0,
            toughness: 1.47,
            weakness: 0,
          },
        ],
      },
      {
        name: "Hold",
        newName: "(Hold)",
        hidden: true,
        actionTime: 0,
        damage: [],
      },
    ],
  },
} satisfies EnrichedEcho
