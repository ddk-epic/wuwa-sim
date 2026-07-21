import type { EchoSet } from "#/types/echo-set"
import raw from "./raw/molten-rift.json"

export const moltenRift = {
  ...raw,
  type: raw.type as "two-five",
  buffs: [
    {
      id: "echo-set.molten-rift.2pc.fusion-bonus",
      name: "Molten Rift 2pc",
      description: "Fusion DMG +10%.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      requiresPieces: 2,
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    },
    {
      id: "echo-set.molten-rift.5pc.fusion-bonus",
      name: "Molten Rift 5pc",
      description: "Fusion DMG +30% for 15s after releasing Resonance Skill.",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillCategory: "Resonance Skill",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 15 },
      stacking: { max: 1, onRetrigger: "refresh" },
      requiresPieces: 5,
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Fusion" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    },
  ],
} satisfies EchoSet
