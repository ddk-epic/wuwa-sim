import type { EchoSet } from "#/types/echo-set"
import raw from "./raw/gusts-of-welkin.json"

export const gustsOfWelkin = {
  ...raw,
  type: raw.type as "two-five",
  buffs: [
    {
      id: "echo-set.gusts-of-welkin.2pc.aero-bonus",
      name: "Gusts of Welkin 2pc",
      description: "Aero DMG +10%.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      requiresPieces: 2,
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Aero" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    },
    {
      id: "echo-set.gusts-of-welkin.5pc.team-aero",
      name: "Gusts of Welkin 5pc",
      description:
        "Inflicting Aero Erosion grants all party members Aero DMG +15% for 20s.",
      trigger: {
        event: "negStatusInflicted",
        status: "Aero Erosion",
        actor: "self",
      },
      target: { kind: "global" },
      duration: { kind: "seconds", v: 20 },
      stacking: { max: 1, onRetrigger: "refresh" },
      requiresPieces: 5,
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Aero" },
          value: { kind: "const", v: 0.15 },
        },
      ],
    },
    {
      // Stacks on top of the team-wide share for the inflicter only.
      id: "echo-set.gusts-of-welkin.5pc.self-aero",
      name: "Gusts of Welkin 5pc (inflicter)",
      description:
        "The Resonator inflicting Aero Erosion gains an additional Aero DMG +15% for 20s.",
      trigger: {
        event: "negStatusInflicted",
        status: "Aero Erosion",
        actor: "self",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 20 },
      stacking: { max: 1, onRetrigger: "refresh" },
      requiresPieces: 5,
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Aero" },
          value: { kind: "const", v: 0.15 },
        },
      ],
    },
  ],
} satisfies EchoSet
