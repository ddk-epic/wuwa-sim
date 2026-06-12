import type { EnrichedEcho } from "#/types/echo"

export const bellBorneGeochelone = {
  id: 390080005,
  name: "Bell-Borne Geochelone",
  cost: 1,
  element: "Glacio",
  sets: ["Moonlit Clouds", "Rejuvenating Glow"],
  buffs: [
    {
      id: "echo.bell-borne-geochelone.dmg-boost",
      name: "Bell-Borne Geochelone (DMG Boost)",
      description:
        "On Echo Skill cast (Tap), grants team +10% All DMG Bonus for 15s. (In-game shield, DMG reduction, and 3-hits expiry are not modeled — deferred to a future shield/defense pass.)",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillCategory: "Echo Skill",
        stage: "tap",
      },
      target: { kind: "global" },
      duration: { kind: "seconds", v: 15 },
      effects: [
        {
          kind: "stat",
          path: { stat: "allDmgBonus" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    },
  ],
  skill: {
    cooldown: 20,
    description:
      "Activate the protection of Bell-Borne Geochelone. Deal Glacio DMG based on 145.92% of the current character's DEF to nearby enemies, and obtain a Bell-Borne Shield that lasts for 15sThe Bell-Borne Shield provides 50.00% DMG Reduction and 10.00% DMG Boost for the current team members, and disappears after the current character is hit for 3 times.CD: 20s",
    stages: [
      {
        name: "Tap",
        newName: "",
        actionTime: 0,
        damage: [
          {
            type: "Echo Skill",
            dmgType: "Damage",
            scalingStat: "DEF",
            actionFrame: 0,
            value: 1.4592,
            energy: 4.55,
            concerto: 0,
            toughness: 1.52,
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
