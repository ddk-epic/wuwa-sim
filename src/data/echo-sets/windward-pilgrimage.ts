import type { EchoSet } from "#/types/echo-set"
import raw from "./raw/windward-pilgrimage.json"

export const windwardPilgrimage = {
  ...raw,
  type: raw.type as "two-five",
  buffs: [
    {
      id: "echo-set.windward-pilgrimage.2pc.aero-bonus",
      name: "Windward Pilgrimage 2pc",
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
      id: "echo-set.windward-pilgrimage.5pc.aero-crit",
      name: "Windward Pilgrimage 5pc",
      description:
        "Hitting a target with Aero Erosion grants Crit. Rate +10% and Aero DMG +30% for 10s.",
      trigger: {
        event: "hitLanded",
        actor: "self",
        source: "self",
        targetHasStatus: "Aero Erosion",
      },
      target: { kind: "self" },
      duration: { kind: "seconds", v: 10 },
      stacking: { max: 1, onRetrigger: "refresh" },
      requiresPieces: 5,
      effects: [
        {
          kind: "stat",
          path: { stat: "critRate" },
          value: { kind: "const", v: 0.1 },
        },
        {
          kind: "stat",
          path: { stat: "elementBonus", key: "Aero" },
          value: { kind: "const", v: 0.3 },
        },
      ],
    },
  ],
} satisfies EchoSet
