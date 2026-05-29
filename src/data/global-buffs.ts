import type { BuffDef } from "#/types/buff"

export const globalBuffs: BuffDef[] = [
  {
    id: "char.shorekeeper.lib.outer-stellarealm",
    name: "Outer Stellarealm",
    description:
      "Resonance Liberation creates Outer Stellarealm for 30s (S0 only).",
    owner: 1505,
    maxSequence: 0,
    trigger: {
      event: "skillCast",
      characterId: 1505,
      skillCategory: "Resonance Liberation",
    },
    target: { kind: "team" },
    duration: { kind: "seconds", v: 30 },
    effects: [],
  },
  {
    id: "char.shorekeeper.lib.outer-stellarealm",
    name: "Outer Stellarealm",
    description:
      "Resonance Liberation creates Outer Stellarealm for 40s (S1+).",
    owner: 1505,
    requiresSequence: 1,
    trigger: {
      event: "skillCast",
      characterId: 1505,
      skillCategory: "Resonance Liberation",
    },
    target: { kind: "team" },
    duration: { kind: "seconds", v: 40 },
    effects: [],
  },
  {
    id: "char.shorekeeper.s2.outer-stellarealm-atk",
    name: "S2: Outer Stellarealm (ATK)",
    description:
      "Resonance Liberation grants team ATK +40% for Outer Stellarealm duration.",
    owner: 1505,
    requiresSequence: 2,
    trigger: {
      event: "skillCast",
      characterId: 1505,
      skillCategory: "Resonance Liberation",
    },
    target: { kind: "team" },
    duration: {
      kind: "inherit",
      buffId: "char.shorekeeper.lib.outer-stellarealm",
    },
    effects: [
      {
        kind: "stat",
        path: { stat: "atkPct" },
        value: { kind: "const", v: 0.4 },
      },
    ],
  },
  {
    id: "char.shorekeeper.lib.inner-stellarealm",
    name: "Inner Stellarealm",
    description:
      "Team Intro while Outer Stellarealm is active grants team Crit. Rate scaling with Shorekeeper's Energy Regen (max 12.5%), inheriting Outer Stellarealm's duration.",
    owner: 1505,
    maxSequence: 0,
    trigger: {
      event: "skillCast",
      actor: "any",
      skillCategory: "Intro Skill",
    },
    condition: {
      kind: "buffActive",
      buffId: "char.shorekeeper.lib.outer-stellarealm",
      on: "source",
    },
    target: { kind: "team" },
    duration: {
      kind: "inherit",
      buffId: "char.shorekeeper.lib.outer-stellarealm",
    },
    effects: [
      {
        kind: "stat",
        path: { stat: "critRate" },
        value: {
          kind: "scaledByStat",
          stat: "energyRechargePct",
          characterId: 1505,
          base: 1,
          per: 0.002,
          scale: 0.0001,
          max: 0.125,
        },
      },
    ],
  },
  {
    id: "char.shorekeeper.lib.supernal-stellarealm",
    name: "Supernal Stellarealm",
    description:
      "Team Intro while Inner Stellarealm is active grants team Crit. DMG scaling with Shorekeeper's Energy Regen (max 25%), inheriting Inner Stellarealm's duration.",
    owner: 1505,
    maxSequence: 0,
    trigger: {
      event: "skillCast",
      actor: "any",
      skillCategory: "Intro Skill",
    },
    condition: {
      kind: "buffActive",
      buffId: "char.shorekeeper.lib.inner-stellarealm",
      on: "source",
    },
    target: { kind: "team" },
    duration: {
      kind: "inherit",
      buffId: "char.shorekeeper.lib.inner-stellarealm",
    },
    effects: [
      {
        kind: "stat",
        path: { stat: "critDmg" },
        value: {
          kind: "scaledByStat",
          stat: "energyRechargePct",
          characterId: 1505,
          base: 1,
          per: 0.001,
          scale: 0.0001,
          max: 0.25,
        },
      },
    ],
  },
  {
    id: "char.shorekeeper.outro.binary-butterfly",
    name: "Binary Butterfly",
    description: "Outro Skill grants all team members allDeepen +15% for 30s.",
    owner: 1505,
    trigger: {
      event: "skillCast",
      characterId: 1505,
      skillCategory: "Outro Skill",
    },
    target: { kind: "team" },
    duration: { kind: "seconds", v: 30 },
    effects: [
      {
        kind: "stat",
        path: { stat: "allDeepen" },
        value: { kind: "const", v: 0.15 },
      },
    ],
  },
]
