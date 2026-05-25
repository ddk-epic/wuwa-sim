import type { EnrichedEcho } from "#/types/echo"

export const fallacyOfNoReturn = {
  id: 6000060,
  name: "Fallacy of No Return",
  cost: 4,
  element: "Spectro",
  sets: ["Rejuvenating Glow"],
  buffs: [],
  skill: {
    cooldown: 20,
    description:
      "Activate the Echo Skill to summon a fraction of the Fallacy of No Return's power and deal a blast to the surrounding area, inflicting Spectro DMG equal to 15.86% of max HP, after which the Resonator gains 10% bonus Energy Regen and all team members 10% bonus ATK for 20s.Hold Echo Skill to unleash a series of flurry assaults at the cost of STA, each dealing Spectro DMG equal to 1.58% of max HP; Release to end the assail in a powerful blow, dealing Spectro DMG equal to 19.82% of max HP.CD: 20s",
    stages: [
      {
        name: "Tap",
        newName: "",
        actionTime: 0,
        damage: [
          {
            type: "Echo Skill",
            dmgType: "Damage",
            scalingStat: "HP",
            actionFrame: 0,
            value: 0.1585,
            energy: 3.04,
            concerto: 0,
            toughness: 1.216,
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
            scalingStat: "HP",
            actionFrame: 0,
            value: 0.0158,
            energy: 0.3,
            concerto: 0,
            toughness: 0.1216,
            weakness: 0,
          },
          {
            type: "Echo Skill",
            dmgType: "Damage",
            scalingStat: "HP",
            actionFrame: 0,
            value: 0.1982,
            energy: 3.8,
            concerto: 0,
            toughness: 1.52,
            weakness: 0,
          },
        ],
      },
    ],
  },
} satisfies EnrichedEcho
