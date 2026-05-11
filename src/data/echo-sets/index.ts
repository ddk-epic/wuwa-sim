import type { EchoSet } from "#/types/echo-set"
import moltenRiftRaw from "./raw/molten-rift.json"
import moonlitCloudsRaw from "./raw/moonlit-clouds.json"

const moltenRift = {
  ...moltenRiftRaw,
  type: moltenRiftRaw.type as "two-five",
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
      trigger: { event: "skillCast", skillType: "Resonance Skill" },
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

const moonlitClouds = {
  ...moonlitCloudsRaw,
  type: moonlitCloudsRaw.type as "two-five",
  buffs: [
    {
      id: "echo-set.moonlit-clouds.2pc.energy-regen",
      name: "Moonlit Clouds 2pc",
      description:
        "Permanent +10% Energy Regen. Not modeled in v1 (energy regen lands with resource state in slice 6).",
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      requiresPieces: 2,
      effects: [],
    },
    {
      id: "echo-set.moonlit-clouds.5pc.next-atk",
      name: "Moonlit Clouds 5pc",
      description:
        "Upon using Outro Skill, the next Resonator gains +22.5% ATK for 15s.",
      trigger: { event: "skillCast", skillType: "Outro Skill" },
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

export const ALL_ECHO_SETS: EchoSet[] = [moltenRift, moonlitClouds]
