import type { EnrichedEcho } from "#/types/echo"

export const infernoRider = {
  id: 390080007,
  name: "Inferno Rider",
  cost: 4,
  element: "Fusion",
  sets: ["Molten Rift"],
  buffs: [
    {
      id: "echo.inferno-rider.tap.fusion-basic-bonus",
      name: "Inferno Rider (Fusion & Basic)",
      description:
        "After the 3rd Tap hit, the current Resonator gains +12% Fusion DMG and +12% Basic Attack DMG for 15s.",
      trigger: {
        event: "hitLanded",
        actor: "self",
        source: "self",
        stageId: "Inferno Rider::",
        hitIndex: 3,
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 15 },
      stacking: { max: 1, onRetrigger: "refresh" },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.12 },
        },
        {
          kind: "stat",
          path: { stat: "skillTypeBonus", key: "Basic Attack" },
          value: { kind: "const", v: 0.12 },
        },
      ],
    },
  ],
  skill: {
    cooldown: 20,
    description:
      "Transform into the Inferno Rider to launch up to 3 consecutive slashes in a row, each slash dealing 242.40%, 282.80%, and 282.80% Fusion DMG respectively.After the final hit, increase the current Resonator's Fusion DMG by 12.00% and Basic Attack DMG by 12.00% for 15s.Long press the Echo Skill to transform into the Inferno Rider and enter Riding Mode. When exiting Riding Mode, deal 282.80% Fusion DMG to enemies in front.CD: 20s",
    stages: [
      {
        name: "Tap",
        newName: "",
        actionTime: 175,
        damage: [
          {
            type: "Echo Skill",
            dmgType: "Damage",
            scalingStat: "ATK",
            actionFrame: 15,
            value: 2.424,
            energy: 3.78,
            concerto: 0,
            toughness: 1.515,
            weakness: 0,
          },
          {
            type: "Echo Skill",
            dmgType: "Damage",
            scalingStat: "ATK",
            actionFrame: 44,
            value: 2.828,
            energy: 4.41,
            concerto: 0,
            toughness: 1.7675,
            weakness: 0,
          },
          {
            type: "Echo Skill",
            dmgType: "Damage",
            scalingStat: "ATK",
            actionFrame: 121,
            value: 2.828,
            energy: 4.41,
            concerto: 0,
            toughness: 1.7675,
            weakness: 0,
          },
        ],
      },
      {
        name: "Hold",
        newName: "(Hold)",
        hidden: true,
        actionTime: 0,
        damage: [
          {
            type: "Echo Skill",
            dmgType: "Damage",
            scalingStat: "ATK",
            actionFrame: 0,
            value: 2.828,
            energy: 4.41,
            concerto: 0,
            toughness: 1.7675,
            weakness: 0,
          },
        ],
      },
    ],
  },
} satisfies EnrichedEcho
