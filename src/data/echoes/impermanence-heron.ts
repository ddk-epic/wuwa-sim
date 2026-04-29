import type { EnrichedEcho } from "#/types/echo"

export const impermanenceHeron = {
  id: 6000052,
  name: "Impermanence Heron",
  cost: 4,
  element: "Havoc",
  set: "Moonlit Clouds",
  skill: {
    cooldown: 20,
    description:
      "Transform into Impermanence Heron to fly up and smack down, dealing 310.56% Havoc DMG.Long press to stay as Impermanence Heron and continuously spit flames, each attack dealing 55.73% Havoc DMG.Once the initial attack lands on any enemy, the current character regains 10 Resonance Energy. If the current character uses their Outro Skill within the next 15s, the next character's damage dealt will be boosted by 12% for 15s.CD: 20s",
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
            value: 3.1056,
            energy: 4.85,
            concerto: 0,
            toughness: 1.941,
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
            value: 0.5572,
            energy: 0.87,
            concerto: 0,
            toughness: 0.3483,
            weakness: 0,
          },
        ],
      },
    ],
  },
} satisfies EnrichedEcho
