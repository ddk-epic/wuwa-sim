import type { EchoSet } from "#/types/echo-set"
import havocEclipseRaw from "./raw/havoc-eclipse.json"
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

const havocEclipse = {
  ...havocEclipseRaw,
  type: havocEclipseRaw.type as "two-five",
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
      // approximated — in-game each stack has its own 15s timer;
      // this uses one shared timer. Should be revisited at a later time
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
      stacking: { max: 4, onRetrigger: "addStack" },
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

export const ALL_ECHO_SETS: EchoSet[] = [
  moltenRift,
  moonlitClouds,
  rejuvenatingGlow,
  havocEclipse,
]
