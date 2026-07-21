import type { EchoSet } from "#/types/echo-set"
import raw from "./raw/havoc-eclipse.json"

export const havocEclipse = {
  ...raw,
  type: raw.type as "two-five",
  buffs: [
    {
      id: "echo-set.havoc-eclipse.2pc.havoc-bonus",
      name: "Havoc Eclipse 2pc",
      description: "Havoc DMG +10%.",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      requiresPieces: 2,
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Havoc" },
          value: { kind: "const", v: 0.1 },
        },
      ],
    },
    {
      id: "echo-set.havoc-eclipse.5pc.havoc-bonus",
      name: "Havoc Eclipse 5pc",
      // Approximated: in-game each stack has its own 15s timer, this shares one.
      description:
        "Havoc DMG +7.5% after releasing Basic Attack or Heavy Attack. Stacks up to 4 times, each stack lasts 15s.",
      trigger: {
        event: "hitLanded",
        actor: "self",
        skillCategory: ["Basic Attack", "Heavy Attack"],
        source: "self",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 15 },
      stacking: { max: 4, onRetrigger: "addStackRefresh" },
      requiresPieces: 5,
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Havoc" },
          value: { kind: "perStack", v: 0.075 },
        },
      ],
    },
  ],
} satisfies EchoSet
