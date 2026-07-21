import type { EchoSet } from "#/types/echo-set"
import raw from "./raw/moonlit-clouds.json"

export const moonlitClouds = {
  ...raw,
  type: raw.type as "two-five",
  buffs: [
    {
      id: "echo-set.moonlit-clouds.2pc.energy-regen",
      name: "Moonlit Clouds 2pc",
      description: "Permanent +10% Energy Regen.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      requiresPieces: 2,
      effects: [
        {
          kind: "stat",
          path: { stat: "energyRechargePct" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    },
    {
      id: "echo-set.moonlit-clouds.5pc.next-atk",
      name: "Moonlit Clouds 5pc",
      description:
        "Upon using Outro Skill, the next Resonator gains +22.5% ATK for 15s.",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillCategory: "Outro Skill",
      },
      target: { kind: "nextOnField" },
      duration: { kind: "seconds", v: 15 },
      stacking: { max: 1, onRetrigger: "refresh" },
      requiresPieces: 5,
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.225 },
        },
      ],
    },
  ],
} satisfies EchoSet
