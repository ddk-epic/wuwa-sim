import type { EchoSet } from "#/types/echo-set"
import moltenRiftRaw from "./raw/molten-rift.json"
import moonlitCloudsRaw from "./raw/moonlit-clouds.json"
import rejuvenatingGlowRaw from "./raw/rejuvenating-glow.json"

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
      trigger: {
        event: "skillCast",
        actor: "self",
        skillType: "Resonance Skill",
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

const moonlitClouds = {
  ...moonlitCloudsRaw,
  type: moonlitCloudsRaw.type as "two-five",
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
      trigger: { event: "skillCast", actor: "self", skillType: "Outro Skill" },
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

const rejuvenatingGlow = {
  ...rejuvenatingGlowRaw,
  type: rejuvenatingGlowRaw.type as "two-five",
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
      target: { kind: "team" },
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

export const ALL_ECHO_SETS: EchoSet[] = [
  moltenRift,
  moonlitClouds,
  rejuvenatingGlow,
]
