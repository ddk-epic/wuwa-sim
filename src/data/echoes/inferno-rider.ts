import type { EnrichedEcho } from "#/types/echo"

export const infernoRider = {
  id: 390080007,
  name: "Inferno Rider",
  cost: 4,
  element: "Fusion",
  set: "Molten Rift",
  skill: {
    cooldown: 20,
    description:
      "Transform into the Inferno Rider to launch up to 3 consecutive slashes in a row, each slash dealing 242.40%, 282.80%, and 282.80% Fusion DMG respectively.After the final hit, increase the current Resonator's Fusion DMG by 12.00% and Basic Attack DMG by 12.00% for 15s.Long press the Echo Skill to transform into the Inferno Rider and enter Riding Mode. When exiting Riding Mode, deal 282.80% Fusion DMG to enemies in front.CD: 20s",
    stages: [
      {
        name: "Tap",
        newName: "",
        actionTime: 0,
        damage: [
          {
            type: "Echo Skill",
            dmgType: "Damage",
            scalingStat: "ATK",
            actionFrame: 0,
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
            actionFrame: 0,
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
            actionFrame: 0,
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
