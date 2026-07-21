import type { EchoSet } from "#/types/echo-set"
import raw from "./raw/rejuvenating-glow.json"

export const rejuvenatingGlow = {
  ...raw,
  type: raw.type as "two-five",
  buffs: [
    {
      id: "echo-set.rejuvenating-glow.2pc.healing-bonus",
      name: "Rejuvenating Glow 2pc",
      description: "Healing Bonus +10%.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      requiresPieces: 2,
      effects: [
        {
          kind: "stat",
          path: { stat: "healingBonus" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    },
    {
      id: "echo-set.rejuvenating-glow.5pc.team-atk",
      name: "Rejuvenating Glow 5pc",
      description:
        "Upon healing allies, increases ATK of all party members by 15% for 30s.",
      trigger: { event: "healLanded", actor: "self" },
      target: { kind: "global" },
      duration: { kind: "seconds", v: 30 },
      stacking: { max: 1, onRetrigger: "refresh" },
      requiresPieces: 5,
      effects: [
        {
          kind: "stat",
          path: { stat: "atkPct" },
          value: { kind: "const", v: 0.15 },
        },
      ],
    },
  ],
} satisfies EchoSet
